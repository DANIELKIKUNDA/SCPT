import { describe, expect, it } from 'vitest'
import { DeclinaisonAudiovisuelle } from '../../../../domain/aggregates/declinaison-audiovisuelle'
import type { ExportAudiovisuel } from '../../../../domain/aggregates/export-audiovisuel'
import type { DeclinaisonAudiovisuelleRepository } from '../../../../domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../../domain/repositories/export-audiovisuel.repository'
import { DeclinaisonId } from '../../../../domain/value-objects/declinaison-id'
import { FormatVideo } from '../../../../domain/value-objects/format-video'
import { ProjetAudiovisuelId } from '../../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../../domain/value-objects/version-metier'
import { RequestRenderUseCase } from '../request-render.use-case'
import { RetryRenderUseCase } from '../retry-render.use-case'

function fixture() {
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const sourceVersion = VersionMetier.from(3)
  let declinaison = DeclinaisonAudiovisuelle.create({
    id: DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
    projetId: projectId,
    format: FormatVideo.from('HORIZONTAL_16_9'),
    langue: 'fr',
    versionProjetSource: sourceVersion
  })
  declinaison = declinaison.validate(sourceVersion, []).markReadyForRender(sourceVersion)
  const jobs = new Map<string, ExportAudiovisuel>()

  const exportRepo: ExportAudiovisuelRepository = {
    save: async (value) => { jobs.set(value.id.value, value) },
    findById: async (id) => jobs.get(id.value) ?? null,
    findAllByProject: async () => [...jobs.values()],
    findActiveByDeclinaison: async (id) => [...jobs.values()].find((job) => job.declinaisonId.equals(id) && job.isActive) ?? null,
    findByStatuses: async (_projectId, statuses) => [...jobs.values()].filter((job) => statuses.includes(job.statut)),
    maxAttemptForDeclinaison: async (id) => Math.max(0, ...[...jobs.values()].filter((job) => job.declinaisonId.equals(id)).map((job) => job.tentative))
  }
  const declinaisonRepo: DeclinaisonAudiovisuelleRepository = {
    save: async (value) => { declinaison = value },
    findById: async (id) => declinaison.id.equals(id) ? declinaison : null,
    findAllByProject: async () => [declinaison],
    findCurrentBySignature: async () => declinaison
  }
  const versions = { current: () => sourceVersion }
  return { projectId, sourceVersion, jobs, exportRepo, declinaisonRepo, versions, getDeclinaison: () => declinaison }
}

describe('Phase 9 render use cases', () => {
  it('requests a render only for a ready current declination', async () => {
    const f = fixture()
    const job = await new RequestRenderUseCase(f.exportRepo, f.declinaisonRepo, f.versions).execute({
      projectId: f.projectId.value,
      declinaisonId: f.getDeclinaison().id.value
    })
    expect(job.statut).toBe('en_attente')
    expect(job.tentative).toBe(1)
  })

  it('rejects a double active request for the same declination', async () => {
    const f = fixture()
    const useCase = new RequestRenderUseCase(f.exportRepo, f.declinaisonRepo, f.versions)
    const input = { projectId: f.projectId.value, declinaisonId: f.getDeclinaison().id.value }
    await useCase.execute(input)
    await expect(useCase.execute(input)).rejects.toThrow('RENDER_ALREADY_ACTIVE')
  })

  it('rejects an obsolete source version', async () => {
    const f = fixture()
    const useCase = new RequestRenderUseCase(f.exportRepo, f.declinaisonRepo, {
      current: () => VersionMetier.from(f.sourceVersion.value + 1)
    })
    await expect(useCase.execute({
      projectId: f.projectId.value,
      declinaisonId: f.getDeclinaison().id.value
    })).rejects.toThrow('RENDER_SOURCE_OBSOLETE')
  })

  it('retries a failed job as the next attempt', async () => {
    const f = fixture()
    const requested = await new RequestRenderUseCase(f.exportRepo, f.declinaisonRepo, f.versions).execute({
      projectId: f.projectId.value,
      declinaisonId: f.getDeclinaison().id.value
    })
    await f.exportRepo.save(requested.beginPreparation().fail('synthetic'))
    const retry = await new RetryRenderUseCase(f.exportRepo, f.declinaisonRepo, f.versions).execute(requested.id.value)
    expect(retry.tentative).toBe(2)
    expect(retry.statut).toBe('en_attente')
  })
})
