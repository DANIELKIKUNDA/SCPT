import { describe, expect, it } from 'vitest'
import { PisteNarration } from '../../../../domain/aggregates/piste-narration'
import { PisteSousTitres } from '../../../../domain/aggregates/piste-sous-titres'
import type { PisteNarrationRepository } from '../../../../domain/repositories/piste-narration.repository'
import type { PisteSousTitresRepository } from '../../../../domain/repositories/piste-sous-titres.repository'
import { ProjetAudiovisuelId } from '../../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../../domain/value-objects/version-metier'
import { GetSubtitleTrackUseCase } from '../get-subtitle-track.use-case'
import { MarkSubtitlesResyncUseCase } from '../mark-subtitles-resync.use-case'
import { SynchronizeSubtitlesUseCase } from '../synchronize-subtitles.use-case'
import { ValidateSubtitleTrackUseCase } from '../validate-subtitle-track.use-case'
import { ExportSubtitlesUseCase } from '../export-subtitles.use-case'
import type { SubtitleFilePort } from '../../../ports/subtitle-file.port'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')

function subtitleRepo(initial: PisteSousTitres | null = null): PisteSousTitresRepository {
  let track = initial
  return {
    async save(value) { track = value },
    async findById(id) { return track?.id.equals(id) ? track : null },
    async findByDeclinaison(id) { return track?.declinaisonId.equals(id) ? track : null },
    async findMaster() { return track }
  }
}

function narrationRepo(initial: PisteNarration | null): PisteNarrationRepository {
  let track = initial
  return {
    async save(value) { track = value },
    async findById(id) { return track?.id.equals(id) ? track : null },
    async findByProject(id) { return track?.projetId.equals(id) ? track : null }
  }
}

function finalNarration(text = 'Bonjour à tous. Nous étudions les logarithmes.', durationMs = 5600): PisteNarration {
  let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
  track = track.addTake({
    texte: text,
    fichierAudio: 'audio/narration/final.wav',
    dureeMs: durationMs,
    statut: 'generee',
    source: 'piper',
    checksum: 'hash'
  })
  return track.selectFinalTake(track.segments[0].id)
}

describe('Subtitle use cases', () => {
  it('creates the master track lazily', async () => {
    const repo = subtitleRepo()
    const track = await new GetSubtitleTrackUseCase(repo).execute('fr', 1)
    expect(track.langue).toBe('fr')
    expect((await repo.findMaster())?.id.value).toBe(track.id.value)
  })

  it('aligns an empty master track to the current narration version without marking it stale', async () => {
    const repo = subtitleRepo(PisteSousTitres.create({
      langue: 'fr',
      versionNarration: VersionMetier.initial()
    }))
    const track = await new GetSubtitleTrackUseCase(repo).execute('fr', 2)
    expect(track.versionNarration.value).toBe(2)
    expect(track.statut).toBe('brouillon')
    expect(track.segments).toEqual([])
  })

  it('requires a selected final narration before synchronization', async () => {
    const narration = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    await expect(new SynchronizeSubtitlesUseCase(subtitleRepo(), narrationRepo(narration)).execute(projectId.value, 'fr'))
      .rejects.toThrow('FINAL_NARRATION_REQUIRED')
  })

  it('creates timed subtitles from the final narration text and duration', async () => {
    const subtitles = subtitleRepo()
    const result = await new SynchronizeSubtitlesUseCase(subtitles, narrationRepo(finalNarration())).execute(projectId.value, 'fr')
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.segments[0].debutMs).toBe(0)
    expect(result.segments.at(-1)?.finMs).toBe(5600)
    expect(result.statut).toBe('brouillon')
  })

  it('marks an existing track stale after narration changes', async () => {
    let track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'Ancien texte', position: 'bas' }
    ], VersionMetier.initial()).validateAgainst(VersionMetier.initial())
    const repo = subtitleRepo(track)
    await new MarkSubtitlesResyncUseCase(repo).execute()
    track = (await repo.findMaster())!
    expect(track.statut).toBe('a_resynchroniser')
  })

  it('validates against the currently selected narration version', async () => {
    const narration = finalNarration()
    const track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 5600, texte: narration.priseFinale!.texte, position: 'bas' }
    ], narration.versionTexte)
    const repo = subtitleRepo(track)
    const validated = await new ValidateSubtitleTrackUseCase(repo, narrationRepo(narration)).execute(projectId.value)
    expect(validated.statut).toBe('validee')
    expect(validated.versionNarration.value).toBe(narration.versionTexte.value)
  })

  it('rejects validation when a cue exceeds the final narration duration', async () => {
    const narration = finalNarration('Texte court.', 1000)
    const track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1200, texte: 'Trop long', position: 'bas' }
    ], narration.versionTexte)
    await expect(new ValidateSubtitleTrackUseCase(subtitleRepo(track), narrationRepo(narration)).execute(projectId.value))
      .rejects.toThrow('SUBTITLE_OUTSIDE_NARRATION')
  })

  it('refuses export while the track is not validated', async () => {
    const track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'Brouillon', position: 'bas' }
    ], VersionMetier.initial())
    const files: SubtitleFilePort = {
      async exportText() { return { relativeProjectPath: 'subtitles/fr/master.srt', fileName: 'x.srt' } }
    }
    await expect(new ExportSubtitlesUseCase(subtitleRepo(track), files).execute({
      format: 'srt',
      destinationPath: 'x.srt'
    })).rejects.toThrow('SUBTITLE_TRACK_NOT_VALIDATED')
  })

  it('exports a validated track through the file port', async () => {
    const track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'Validé', position: 'bas' }
    ], VersionMetier.initial()).validateAgainst(VersionMetier.initial())
    let captured = ''
    const files: SubtitleFilePort = {
      async exportText(input) {
        captured = input.content
        return { relativeProjectPath: 'subtitles/fr/master.srt', fileName: 'lesson.srt' }
      }
    }
    const result = await new ExportSubtitlesUseCase(subtitleRepo(track), files).execute({
      format: 'srt',
      destinationPath: 'lesson.srt'
    })
    expect(captured).toContain('00:00:00,000 --> 00:00:01,000')
    expect(result.fileName).toBe('lesson.srt')
  })

})
