import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectRenderPayloadBuilder } from '../project-render-payload-builder'
import { DeclinaisonAudiovisuelle } from '../../../domain/aggregates/declinaison-audiovisuelle'
import { PisteNarration } from '../../../domain/aggregates/piste-narration'
import { PisteSousTitres } from '../../../domain/aggregates/piste-sous-titres'
import { RessourceMedia } from '../../../domain/aggregates/ressource-media'
import { Scene } from '../../../domain/aggregates/scene'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import type { RessourceMediaRepository } from '../../../domain/repositories/ressource-media.repository'
import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { FormatVideo } from '../../../domain/value-objects/format-video'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { RessourceMediaId } from '../../../domain/value-objects/ressource-media-id'
import { SceneId } from '../../../domain/value-objects/scene-id'
import { VersionMetier } from '../../../domain/value-objects/version-metier'

const projectId = ProjetAudiovisuelId.from('01J00000000000000000000000')
const sceneId = SceneId.from('01J00000000000000000000001')
const mediaId = RessourceMediaId.from('01J00000000000000000000002')

class MemorySceneRepository implements SequenceSceneRepository {
  constructor(private values: Scene[], private readonly mediaIds = new Map<string, string>()) {}
  async loadSequence(): Promise<Scene[]> { return [...this.values].sort((a, b) => a.ordre - b.ordre) }
  async save(scene: Scene): Promise<void> { this.values = [...this.values.filter((v) => !v.id.equals(scene.id)), scene] }
  async findById(id: SceneId): Promise<Scene | null> { return this.values.find((v) => v.id.equals(id)) ?? null }
  async duplicate(): Promise<Scene> { throw new Error('not used') }
  async delete(): Promise<void> { throw new Error('not used') }
  async reorder(): Promise<void> { throw new Error('not used') }
  async nextOrdre(): Promise<number> { return this.values.length + 1 }
  async getMediaId(id: SceneId): Promise<string | null> { return this.mediaIds.get(id.value) ?? null }
}

class MemoryMediaRepository implements RessourceMediaRepository {
  constructor(private values: RessourceMedia[]) {}
  async save(value: RessourceMedia): Promise<void> { this.values = [...this.values.filter((v) => !v.id.equals(value.id)), value] }
  async findById(id: RessourceMediaId): Promise<RessourceMedia | null> { return this.values.find((v) => v.id.equals(id)) ?? null }
  async findAll(): Promise<RessourceMedia[]> { return [...this.values] }
  async findByChecksum(_projectId: ProjetAudiovisuelId, checksum: string): Promise<RessourceMedia | null> {
    return this.values.find((v) => v.checksum === checksum) ?? null
  }
  async delete(id: RessourceMediaId): Promise<void> { this.values = this.values.filter((v) => !v.id.equals(id)) }
}

class MemoryNarrationRepository implements PisteNarrationRepository {
  constructor(private value: PisteNarration | null) {}
  async save(value: PisteNarration): Promise<void> { this.value = value }
  async findById(): Promise<PisteNarration | null> { return this.value }
  async findByProject(): Promise<PisteNarration | null> { return this.value }
}

class MemorySubtitleRepository implements PisteSousTitresRepository {
  constructor(private value: PisteSousTitres | null) {}
  async save(value: PisteSousTitres): Promise<void> { this.value = value }
  async findById(): Promise<PisteSousTitres | null> { return this.value }
  async findByDeclinaison(): Promise<PisteSousTitres | null> { return this.value }
  async findMaster(): Promise<PisteSousTitres | null> { return this.value }
}

function readyDeclination(sceneIds: string[] = [sceneId.value]) {
  const source = VersionMetier.from(3)
  return DeclinaisonAudiovisuelle.create({
    projetId: projectId,
    format: FormatVideo.horizontal(),
    langue: 'fr',
    versionProjetSource: source
  }).validate(source, sceneIds).markReadyForRender(source)
}

function finalNarration(audioPath = 'audio/narration/final.wav') {
  let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
  track = track.addTake({
    texte: 'Bonjour',
    fichierAudio: audioPath,
    dureeMs: 1500,
    statut: 'generee',
    source: 'piper',
    voixId: 'fr_FR-siwis-medium',
    checksum: 'a'.repeat(64)
  })
  return track.selectFinalTake(track.segments[0].id)
}

function imageScene() {
  return Scene.create({
    id: sceneId,
    projetId: projectId,
    ordre: 1,
    type: 'image',
    titre: 'Illustration',
    texteAffiche: 'Une image locale',
    dureeMs: 1500
  })
}

function textScene() {
  return Scene.create({
    id: sceneId,
    projetId: projectId,
    ordre: 1,
    type: 'texte',
    titre: 'Titre',
    texteAffiche: 'Bonjour',
    dureeMs: 1500
  })
}

function imageMedia() {
  return RessourceMedia.create({
    id: mediaId,
    projetId: projectId,
    type: 'image',
    cheminRelatif: 'media/source/illustration.png',
    nomOriginal: 'illustration.png',
    checksum: 'b'.repeat(64),
    tailleOctets: 8,
    mimeType: 'image/png',
    largeur: 640,
    hauteur: 360,
    droits: 'originale'
  })
}

describe('ProjectRenderPayloadBuilder', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'scpt-render-payload-'))
    mkdirSync(join(projectDir, 'audio', 'narration'), { recursive: true })
    mkdirSync(join(projectDir, 'media', 'source'), { recursive: true })
  })

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }))

  it('requires a validated final narration before rendering', async () => {
    const builder = new ProjectRenderPayloadBuilder(
      projectDir,
      new MemorySceneRepository([textScene()]),
      new MemoryMediaRepository([]),
      new MemoryNarrationRepository(null),
      new MemorySubtitleRepository(null)
    )
    await expect(builder.build(readyDeclination())).rejects.toThrow('RENDER_FINAL_NARRATION_REQUIRED')
  })

  it('embeds local image bytes and validated subtitles into offline Remotion props', async () => {
    writeFileSync(join(projectDir, 'audio', 'narration', 'final.wav'), Buffer.from('RIFF-local-test'))
    writeFileSync(join(projectDir, 'media', 'source', 'illustration.png'), Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]))
    const declination = readyDeclination()
    const subtitles = PisteSousTitres.create({
      declinaisonId: declination.id,
      langue: 'fr',
      versionNarration: VersionMetier.initial()
    }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'Bonjour à tous', position: 'bas', style: { fontSize: 40 } }
    ], VersionMetier.initial()).validateAgainst(VersionMetier.initial())
    const builder = new ProjectRenderPayloadBuilder(
      projectDir,
      new MemorySceneRepository([imageScene()], new Map([[sceneId.value, mediaId.value]])),
      new MemoryMediaRepository([imageMedia()]),
      new MemoryNarrationRepository(finalNarration()),
      new MemorySubtitleRepository(subtitles)
    )

    const props = await builder.build(declination)
    expect(props.scenes).toHaveLength(1)
    expect(props.scenes[0].media?.previewUrl).toMatch(/^data:image\/png;base64,/)
    expect(props.subtitles).toHaveLength(1)
    expect(props.subtitles?.[0].texte).toBe('Bonjour à tous')
    expect(props.declination?.resolution).toEqual({ width: 1920, height: 1080 })
    expect(props.showSafeZone).toBe(false)
  })

  it('rejects a subtitle track that has authored segments but is not validated', async () => {
    writeFileSync(join(projectDir, 'audio', 'narration', 'final.wav'), Buffer.from('RIFF-local-test'))
    const declination = readyDeclination()
    const subtitles = PisteSousTitres.create({ declinaisonId: declination.id, langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'Brouillon', position: 'bas' }
    ], VersionMetier.initial())
    const builder = new ProjectRenderPayloadBuilder(
      projectDir,
      new MemorySceneRepository([textScene()]),
      new MemoryMediaRepository([]),
      new MemoryNarrationRepository(finalNarration()),
      new MemorySubtitleRepository(subtitles)
    )

    await expect(builder.build(declination)).rejects.toThrow('RENDER_SUBTITLES_NOT_VALIDATED')
  })

  it('rejects an image scene whose required media is missing', async () => {
    writeFileSync(join(projectDir, 'audio', 'narration', 'final.wav'), Buffer.from('RIFF-local-test'))
    const builder = new ProjectRenderPayloadBuilder(
      projectDir,
      new MemorySceneRepository([imageScene()]),
      new MemoryMediaRepository([]),
      new MemoryNarrationRepository(finalNarration()),
      new MemorySubtitleRepository(null)
    )

    await expect(builder.build(readyDeclination())).rejects.toThrow(`RENDER_MEDIA_REQUIRED:${sceneId.value}`)
  })
})
