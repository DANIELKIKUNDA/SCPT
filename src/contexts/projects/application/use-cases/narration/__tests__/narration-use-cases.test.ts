import { describe, expect, it } from 'vitest'
import { PisteNarration } from '../../../../domain/aggregates/piste-narration'
import { ProjetAudiovisuelId } from '../../../../domain/value-objects/projet-audiovisuel-id'
import type { PisteNarrationRepository } from '../../../../domain/repositories/piste-narration.repository'
import type { GenerationVoixPort } from '../../../ports/generation-voix.port'
import type { NarrationAudioPort } from '../../../ports/narration-audio.port'
import { GenerateNarrationUseCase } from '../generate-narration.use-case'
import { ImportNarrationUseCase } from '../import-narration.use-case'
import { SelectFinalNarrationTakeUseCase } from '../select-final-take.use-case'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')

function inMemoryRepository(initial: PisteNarration | null = null): PisteNarrationRepository {
  let track = initial
  return {
    async save(value) { track = value },
    async findById(id) { return track?.id.equals(id) ? track : null },
    async findByProject(id) { return track?.projetId.equals(id) ? track : null }
  }
}

describe('Narration use cases', () => {
  it('rejects empty text before voice generation', async () => {
    const repo = inMemoryRepository()
    let called = false
    const voice: GenerationVoixPort = {
      async generate() { called = true; return { cheminRelatif: 'audio/narration/a.wav', dureeMs: 100, checksum: 'a' } }
    }
    const track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    await expect(new GenerateNarrationUseCase(repo, voice).execute({ track, texte: '   ', voixId: 'fr_FR-siwis-medium' })).rejects.toThrow('EMPTY_TEXT')
    expect(called).toBe(false)
  })

  it('persists a generated WAV take', async () => {
    const track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    const repo = inMemoryRepository(track)
    const voice: GenerationVoixPort = {
      async generate() { return { cheminRelatif: 'audio/narration/generated.wav', dureeMs: 5660, checksum: 'generated' } }
    }
    const result = await new GenerateNarrationUseCase(repo, voice).execute({ track, texte: 'Bonjour', voixId: 'fr_FR-siwis-medium' })
    expect(result.segments[0].source).toBe('piper')
    expect(result.segments[0].dureeMs).toBe(5660)
  })

  it('imports an audio take without overwriting the source contract', async () => {
    const track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    const repo = inMemoryRepository(track)
    const audio: NarrationAudioPort = {
      async importAudio() { return { cheminRelatif: 'audio/narration/import.wav', dureeMs: 900, checksum: 'import', mimeType: 'audio/wav', nomOriginal: 'voice.wav' } },
      async readBase64() { return { base64: '', mimeType: 'audio/wav' } }
    }
    const result = await new ImportNarrationUseCase(repo, audio).execute({ track, sourcePath: 'C:/user/voice.wav' })
    expect(result.segments[0].source).toBe('import')
    expect(result.segments[0].fichierAudio).toBe('audio/narration/import.wav')
  })

  it('changes the final take selection', async () => {
    let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    track = track.addTake({ texte: 'A', fichierAudio: 'audio/narration/a.wav', dureeMs: 100, statut: 'generee', source: 'piper', checksum: 'a' })
    track = track.addTake({ texte: 'B', fichierAudio: 'audio/narration/b.wav', dureeMs: 200, statut: 'generee', source: 'piper', checksum: 'b' })
    const repo = inMemoryRepository(track)
    const selected = await new SelectFinalNarrationTakeUseCase(repo).execute(projectId.value, track.segments[1].id)
    expect(selected.priseFinaleId).toBe(track.segments[1].id)
  })
})
