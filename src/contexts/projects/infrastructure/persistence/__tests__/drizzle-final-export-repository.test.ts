import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ExportFinalAudiovisuel } from '../../../domain/aggregates/export-final-audiovisuel'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ExportId } from '../../../domain/value-objects/export-id'
import { ProfilExport } from '../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { createDrizzleFinalExportRepository } from '../drizzle-final-export-repository'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-final-export-repo-'))
  roots.push(root)
  const repo = createDrizzleFinalExportRepository(join(root, 'project.sqlite'))
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const renderJobId = ExportId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
  const item = ExportFinalAudiovisuel.request({
    projetId: projectId,
    renderJobId,
    declinaisonId: DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAX'),
    tentative: 1,
    profil: ProfilExport.mvpPremium(),
    sourceRenderChecksum: 'a'.repeat(64),
    narrationTakeId: 'take-1',
    narrationChecksum: 'b'.repeat(64)
  }).enqueue()
  return { repo, projectId, renderJobId, item }
}

describe('DrizzleFinalExportRepository', () => {
  it('persists and restores a queued final export', async () => {
    const { repo, item } = fixture()
    try {
      await repo.save(item)
      const loaded = await repo.findById(item.id)
      expect(loaded?.statut).toBe('en_attente')
      expect(loaded?.sourceRenderChecksum).toBe('a'.repeat(64))
      expect(loaded?.narrationChecksum).toBe('b'.repeat(64))
    } finally {
      repo.close()
    }
  })

  it('updates one row through completion without duplicating it', async () => {
    const { repo, projectId, item } = fixture()
    try {
      let value = item.beginPreparation().beginEncoding().updateEncodingProgress(70).beginVerification()
      value = value.complete({
        nomFichier: 'final.mp4', cheminFichier: 'renders/final/final.mp4', checksum: 'c'.repeat(64),
        tailleOctets: 1000, dureeMs: 3000, largeur: 1920, hauteur: 1080, fps: 30,
        codecVideo: 'h264', pixelFormat: 'yuv420p', codecAudio: 'aac', audioSampleRate: 48000
      })
      await repo.save(value)
      const all = await repo.findAllByProject(projectId)
      expect(all).toHaveLength(1)
      expect(all[0].statut).toBe('termine')
      expect(all[0].technique?.codecAudio).toBe('aac')
    } finally {
      repo.close()
    }
  })

  it('finds an active export and the highest attempt for one render job', async () => {
    const { repo, renderJobId, item } = fixture()
    try {
      await repo.save(item)
      expect((await repo.findActiveByRenderJob(renderJobId))?.id.value).toBe(item.id.value)
      expect(await repo.maxAttemptForRenderJob(renderJobId)).toBe(1)
    } finally {
      repo.close()
    }
  })

  it('finds interrupted exports by status for recovery', async () => {
    const { repo, projectId, item } = fixture()
    try {
      const active = item.beginPreparation().beginEncoding().updateEncodingProgress(42)
      await repo.save(active)
      const found = await repo.findByStatuses(projectId, ['en_encodage'])
      expect(found).toHaveLength(1)
      expect(found[0].progression).toBe(42)
    } finally {
      repo.close()
    }
  })
})
