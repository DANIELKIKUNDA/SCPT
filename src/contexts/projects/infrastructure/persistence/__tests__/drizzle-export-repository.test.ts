import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ExportAudiovisuel } from '../../../domain/aggregates/export-audiovisuel'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProfilExport } from '../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../domain/value-objects/version-metier'
import { createDrizzleExportRepository } from '../drizzle-export-repository'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-render-repo-'))
  roots.push(root)
  const repo = createDrizzleExportRepository(join(root, 'project.sqlite'))
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
  const job = ExportAudiovisuel.request({
    projetId: projectId,
    declinaisonId,
    tentative: 1,
    profil: ProfilExport.mvpPremium(),
    versionsSources: {
      versionProjetSource: VersionMetier.from(2),
      versionDeclinaison: VersionMetier.from(4)
    }
  }).enqueue()
  return { repo, projectId, declinaisonId, job }
}

describe('DrizzleExportRepository', () => {
  it('persists and restores a render job', async () => {
    const { repo, job } = fixture()
    try {
      await repo.save(job)
      const loaded = await repo.findById(job.id)
      expect(loaded?.statut).toBe('en_attente')
      expect(loaded?.versionsSources.versionDeclinaison.value).toBe(4)
    } finally {
      repo.close()
    }
  })

  it('updates progress without duplicating the job', async () => {
    const { repo, projectId, job } = fixture()
    try {
      let updated = job.beginPreparation().beginComposition().updateCompositionProgress(66)
      await repo.save(updated)
      updated = updated.beginVerification().complete({
        cheminFichier: 'renders/previews/test.mp4', checksum: 'c'.repeat(64)
      })
      await repo.save(updated)
      const all = await repo.findAllByProject(projectId)
      expect(all).toHaveLength(1)
      expect(all[0].statut).toBe('termine')
    } finally {
      repo.close()
    }
  })

  it('finds active jobs and next attempt number', async () => {
    const { repo, declinaisonId, job } = fixture()
    try {
      await repo.save(job)
      expect((await repo.findActiveByDeclinaison(declinaisonId))?.id.value).toBe(job.id.value)
      expect(await repo.maxAttemptForDeclinaison(declinaisonId)).toBe(1)
    } finally {
      repo.close()
    }
  })

  it('finds interrupted processing jobs by status', async () => {
    const { repo, projectId, job } = fixture()
    try {
      const active = job.beginPreparation().beginComposition().updateCompositionProgress(34)
      await repo.save(active)
      const interrupted = await repo.findByStatuses(projectId, ['en_composition'])
      expect(interrupted).toHaveLength(1)
      expect(interrupted[0].progression).toBe(34)
    } finally {
      repo.close()
    }
  })
})
