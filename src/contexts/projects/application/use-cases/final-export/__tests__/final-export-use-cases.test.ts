import { describe, expect, it } from 'vitest'
import { ExportAudiovisuel } from '../../../../domain/aggregates/export-audiovisuel'
import { PisteNarration } from '../../../../domain/aggregates/piste-narration'
import { RessourceMedia } from '../../../../domain/aggregates/ressource-media'
import type { ExportFinalAudiovisuel } from '../../../../domain/aggregates/export-final-audiovisuel'
import type { ExportAudiovisuelRepository } from '../../../../domain/repositories/export-audiovisuel.repository'
import type { ExportFinalAudiovisuelRepository } from '../../../../domain/repositories/export-final-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../../../domain/repositories/piste-narration.repository'
import type { RessourceMediaRepository } from '../../../../domain/repositories/ressource-media.repository'
import { DeclinaisonId } from '../../../../domain/value-objects/declinaison-id'
import { ProfilExport } from '../../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../../domain/value-objects/version-metier'
import { RequestFinalExportUseCase } from '../request-final-export.use-case'
import { RetryFinalExportUseCase } from '../retry-final-export.use-case'

function fixture(options?: { rights?: 'originale' | 'autorisee' | 'libre' | 'inconnue' | 'interdite'; mediaMissing?: boolean }) {
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
  const sourceVersion = VersionMetier.from(3)
  const render = ExportAudiovisuel.request({
    projetId: projectId, declinaisonId, tentative: 1, profil: ProfilExport.mvpPremium(),
    versionsSources: { versionProjetSource: sourceVersion, versionDeclinaison: VersionMetier.from(5) }
  }).enqueue().beginPreparation().beginComposition().beginVerification().complete({
    cheminFichier: 'renders/previews/source.mp4', checksum: 'a'.repeat(64)
  })
  let narration = PisteNarration.create({ projetId: projectId, langue: 'fr' })
  narration = narration.addTake({
    texte: 'Texte final', fichierAudio: 'audio/narration/final.wav', dureeMs: 3000,
    statut: 'generee', source: 'piper', checksum: 'b'.repeat(64)
  })
  narration = narration.selectFinalTake(narration.segments[0].id)
  let media = RessourceMedia.create({
    projetId: projectId, type: 'image', cheminRelatif: 'media/source/a.png', nomOriginal: 'a.png',
    checksum: 'c'.repeat(64), tailleOctets: 10, mimeType: 'image/png', droits: options?.rights ?? 'originale'
  })
  if (options?.mediaMissing) media = media.marquerManquante()

  const finalMap = new Map<string, ExportFinalAudiovisuel>()
  const finalRepo: ExportFinalAudiovisuelRepository = {
    save: async (value) => { finalMap.set(value.id.value, value) },
    findById: async (id) => finalMap.get(id.value) ?? null,
    findAllByProject: async () => [...finalMap.values()],
    findActiveByRenderJob: async (id) => [...finalMap.values()].find((value) => value.renderJobId.equals(id) && value.isActive) ?? null,
    findByStatuses: async (_id, statuses) => [...finalMap.values()].filter((value) => statuses.includes(value.statut)),
    maxAttemptForRenderJob: async (id) => Math.max(0, ...[...finalMap.values()].filter((value) => value.renderJobId.equals(id)).map((value) => value.tentative))
  }
  const renderRepo: ExportAudiovisuelRepository = {
    save: async () => undefined,
    findById: async (id) => id.equals(render.id) ? render : null,
    findAllByProject: async () => [render],
    findActiveByDeclinaison: async () => null,
    findByStatuses: async () => [],
    maxAttemptForDeclinaison: async () => 1
  }
  const narrationRepo: PisteNarrationRepository = {
    save: async (value) => { narration = value },
    findById: async () => narration,
    findByProject: async () => narration
  }
  const mediaRepo: RessourceMediaRepository = {
    save: async (value) => { media = value },
    findById: async (id) => id.equals(media.id) ? media : null,
    findAll: async () => [media],
    findByChecksum: async () => media,
    delete: async () => undefined
  }
  const sourceVersions = { current: async () => sourceVersion }
  const request = new RequestFinalExportUseCase(finalRepo, renderRepo, narrationRepo, mediaRepo, sourceVersions)
  return {
    projectId, render, narration, media, finalMap, finalRepo, renderRepo, narrationRepo,
    sourceVersions, request,
    setNarration: (value: PisteNarration) => { narration = value }
  }
}

describe('Phase 10 final-export use cases', () => {
  it('requests and persists a queued final export from a completed render', async () => {
    const f = fixture()
    const result = await f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value })
    expect(result.statut).toBe('en_attente')
    expect(result.sourceRenderChecksum).toBe(f.render.checksum)
    expect(result.narrationTakeId).toBe(f.narration.priseFinale?.id)
    expect(f.finalMap.get(result.id.value)).toBe(result)
  })

  it('blocks unknown media rights before final export', async () => {
    const f = fixture({ rights: 'inconnue' })
    await expect(f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value }))
      .rejects.toThrow('FINAL_EXPORT_MEDIA_RIGHTS_UNKNOWN')
  })

  it('blocks explicitly forbidden media rights', async () => {
    const f = fixture({ rights: 'interdite' })
    await expect(f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value }))
      .rejects.toThrow('FINAL_EXPORT_MEDIA_FORBIDDEN')
  })

  it('blocks missing or corrupt project media', async () => {
    const f = fixture({ mediaMissing: true })
    await expect(f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value }))
      .rejects.toThrow('FINAL_EXPORT_MEDIA_UNAVAILABLE')
  })

  it('blocks a second active export of the same render job', async () => {
    const f = fixture()
    await f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value })
    await expect(f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value }))
      .rejects.toThrow('FINAL_EXPORT_ALREADY_ACTIVE')
  })

  it('requires a validated final narration take', async () => {
    const f = fixture()
    f.setNarration(PisteNarration.create({ projetId: f.projectId, langue: 'fr' }))
    await expect(f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value }))
      .rejects.toThrow('FINAL_EXPORT_AUDIO_MISSING')
  })

  it('retries a failed final export with the current render and narration checksums', async () => {
    const f = fixture()
    const requested = await f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value })
    await f.finalRepo.save(requested.beginPreparation().fail('synthetic'))
    const retry = new RetryFinalExportUseCase(f.finalRepo, f.renderRepo, f.narrationRepo, f.sourceVersions)
    const result = await retry.execute(requested.id.value)
    expect(result.statut).toBe('en_attente')
    expect(result.tentative).toBe(2)
    expect(result.sourceRenderChecksum).toBe(f.render.checksum)
    expect(result.narrationChecksum).toBe(f.narration.priseFinale?.checksum)
  })

  it('refuses retry when the source export is not retryable', async () => {
    const f = fixture()
    const requested = await f.request.execute({ projectId: f.projectId.value, renderJobId: f.render.id.value })
    const retry = new RetryFinalExportUseCase(f.finalRepo, f.renderRepo, f.narrationRepo, f.sourceVersions)
    await expect(retry.execute(requested.id.value)).rejects.toThrow('FINAL_EXPORT_NOT_RETRYABLE')
  })
})
