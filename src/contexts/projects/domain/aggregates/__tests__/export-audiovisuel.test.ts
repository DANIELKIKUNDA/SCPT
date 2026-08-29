import { describe, expect, it } from 'vitest'
import { ExportAudiovisuel } from '../export-audiovisuel'
import { DeclinaisonId } from '../../value-objects/declinaison-id'
import { ProfilExport } from '../../value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../value-objects/version-metier'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const versions = {
  versionProjetSource: VersionMetier.from(3),
  versionDeclinaison: VersionMetier.from(5)
}

function requested(): ExportAudiovisuel {
  return ExportAudiovisuel.request({
    projetId: projectId,
    declinaisonId,
    tentative: 1,
    profil: ProfilExport.mvpPremium(),
    versionsSources: versions,
    now: new Date('2026-08-29T08:00:00.000Z')
  })
}

describe('ExportAudiovisuel', () => {
  it('creates a requested render with immutable source versions', () => {
    const job = requested()
    expect(job.statut).toBe('demande')
    expect(job.progression).toBe(0)
    expect(job.tentative).toBe(1)
    expect(job.versionsSources.versionProjetSource.value).toBe(3)
    expect(job.versionsSources.versionDeclinaison.value).toBe(5)
  })

  it('moves through the render lifecycle monotonically', () => {
    let job = requested().enqueue().beginPreparation().beginComposition()
    job = job.updateCompositionProgress(40)
    job = job.updateCompositionProgress(20)
    expect(job.progression).toBe(40)
    job = job.beginEncoding().beginVerification()
    job = job.complete({
      cheminFichier: 'renders/previews/test.mp4',
      checksum: 'a'.repeat(64)
    })
    expect(job.statut).toBe('termine')
    expect(job.progression).toBe(100)
  })

  it('rejects absolute output paths', () => {
    const verifying = requested().enqueue().beginPreparation().beginComposition().beginVerification()
    expect(() => verifying.complete({ cheminFichier: 'C:/escape.mp4', checksum: 'a'.repeat(64) })).toThrow()
  })

  it('fails without presenting a partial output as valid', () => {
    const failed = requested().enqueue().beginPreparation().fail('Browser unavailable')
    expect(failed.statut).toBe('echoue')
    expect(failed.cheminFichier).toBeNull()
    expect(failed.checksum).toBeNull()
    expect(failed.diagnostic).toContain('Browser')
  })

  it('cancels an active job idempotently', () => {
    const cancelled = requested().enqueue().cancel()
    expect(cancelled.statut).toBe('annule')
    expect(cancelled.cancel()).toBe(cancelled)
  })

  it('retries a failed job as a new attempt', () => {
    const failed = requested().enqueue().beginPreparation().fail('x')
    const retry = failed.retry({
      versionProjetSource: VersionMetier.from(4),
      versionDeclinaison: VersionMetier.from(6)
    })
    expect(retry.statut).toBe('demande')
    expect(retry.tentative).toBe(2)
    expect(retry.diagnostic).toBeNull()
    expect(retry.versionsSources.versionProjetSource.value).toBe(4)
  })

  it('refuses retry for a completed immutable output', () => {
    const done = requested().enqueue().beginPreparation().beginComposition().beginVerification().complete({
      cheminFichier: 'renders/previews/test.mp4', checksum: 'b'.repeat(64)
    })
    expect(() => done.retry(versions)).toThrow('RENDER_NOT_RETRYABLE')
  })

  it('requeues interrupted processing with a new attempt', () => {
    const active = requested().enqueue().beginPreparation().beginComposition().updateCompositionProgress(55)
    const recovered = active.prepareForResume()
    expect(recovered.statut).toBe('en_attente')
    expect(recovered.tentative).toBe(2)
    expect(recovered.progression).toBe(0)
    expect(recovered.diagnostic).toContain('Reprise automatique')
  })

  it('keeps a queued job stable during recovery', () => {
    const queued = requested().enqueue()
    expect(queued.prepareForResume()).toBe(queued)
  })
})
