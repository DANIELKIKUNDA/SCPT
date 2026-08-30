import { describe, expect, it } from 'vitest'
import { ExportFinalAudiovisuel, type ExportFinalTechnique } from '../export-final-audiovisuel'
import { DeclinaisonId } from '../../value-objects/declinaison-id'
import { ExportId } from '../../value-objects/export-id'
import { ProfilExport } from '../../value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const renderJobId = ExportId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAX')
const checksumVideo = 'a'.repeat(64)
const checksumAudio = 'b'.repeat(64)

const technique: ExportFinalTechnique = {
  nomFichier: 'Cours_16x9_test.mp4',
  cheminFichier: 'renders/final/Cours_16x9_test.mp4',
  checksum: 'c'.repeat(64),
  tailleOctets: 2048,
  dureeMs: 3000,
  largeur: 1920,
  hauteur: 1080,
  fps: 30,
  codecVideo: 'h264',
  pixelFormat: 'yuv420p',
  codecAudio: 'aac',
  audioSampleRate: 48000
}

function requested(): ExportFinalAudiovisuel {
  return ExportFinalAudiovisuel.request({
    projetId: projectId,
    renderJobId,
    declinaisonId,
    tentative: 1,
    profil: ProfilExport.mvpPremium(),
    sourceRenderChecksum: checksumVideo,
    narrationTakeId: 'take-final-1',
    narrationChecksum: checksumAudio,
    now: new Date('2026-08-29T16:00:00.000Z')
  })
}

describe('ExportFinalAudiovisuel', () => {
  it('creates a requested final export with frozen source checksums', () => {
    const value = requested()
    expect(value.statut).toBe('demande')
    expect(value.progression).toBe(0)
    expect(value.sourceRenderChecksum).toBe(checksumVideo)
    expect(value.narrationChecksum).toBe(checksumAudio)
    expect(value.technique).toBeNull()
  })

  it('moves monotonically through preparation, encoding, verification and completion', () => {
    let value = requested().enqueue().beginPreparation().beginEncoding()
    value = value.updateEncodingProgress(50)
    value = value.updateEncodingProgress(20)
    expect(value.progression).toBe(50)
    value = value.beginVerification().complete(technique)
    expect(value.statut).toBe('termine')
    expect(value.progression).toBe(100)
    expect(value.technique?.cheminFichier).toBe(technique.cheminFichier)
  })

  it('rejects an absolute completed output path', () => {
    const value = requested().enqueue().beginPreparation().beginEncoding().beginVerification()
    expect(() => value.complete({ ...technique, cheminFichier: 'C:/escape/final.mp4' }))
      .toThrow('FINAL_EXPORT_PATH_MUST_BE_RELATIVE')
  })

  it('rejects a non-H264/AAC final profile', () => {
    const value = requested().enqueue().beginPreparation().beginEncoding().beginVerification()
    expect(() => value.complete({ ...technique, codecVideo: 'vp9' as 'h264' }))
      .toThrow('FINAL_EXPORT_INVALID_VIDEO_PROFILE')
    expect(() => value.complete({ ...technique, audioSampleRate: 44100 as 48000 }))
      .toThrow('FINAL_EXPORT_INVALID_AUDIO_PROFILE')
  })

  it('fails without exposing technical metadata as a valid export', () => {
    const value = requested().enqueue().beginPreparation().fail('FFmpeg synthetic failure')
    expect(value.statut).toBe('echoue')
    expect(value.technique).toBeNull()
    expect(value.diagnostic).toContain('FFmpeg')
    expect(value.canRetry).toBe(true)
  })

  it('cancels an active final export idempotently', () => {
    const cancelled = requested().enqueue().cancel()
    expect(cancelled.statut).toBe('annule')
    expect(cancelled.cancel()).toBe(cancelled)
  })

  it('retries a failed final export with refreshed immutable inputs', () => {
    const failed = requested().enqueue().beginPreparation().fail('x')
    const retried = failed.retry({
      sourceRenderChecksum: 'd'.repeat(64),
      narrationTakeId: 'take-final-2',
      narrationChecksum: 'e'.repeat(64)
    })
    expect(retried.statut).toBe('demande')
    expect(retried.tentative).toBe(2)
    expect(retried.sourceRenderChecksum).toBe('d'.repeat(64))
    expect(retried.narrationTakeId).toBe('take-final-2')
    expect(retried.diagnostic).toBeNull()
  })

  it('does not permit retrying an immutable completed export', () => {
    const done = requested().enqueue().beginPreparation().beginEncoding().beginVerification().complete(technique)
    expect(() => done.retry({
      sourceRenderChecksum: checksumVideo,
      narrationTakeId: 'take-final-1',
      narrationChecksum: checksumAudio
    })).toThrow('FINAL_EXPORT_NOT_RETRYABLE')
  })

  it('turns interrupted processing into a clean queued recovery attempt', () => {
    const active = requested().enqueue().beginPreparation().beginEncoding().updateEncodingProgress(58)
    const resumed = active.prepareForResume()
    expect(resumed.statut).toBe('en_attente')
    expect(resumed.tentative).toBe(2)
    expect(resumed.progression).toBe(0)
    expect(resumed.diagnostic).toContain('Reprise automatique')
  })

  it('keeps an already queued attempt stable during recovery', () => {
    const queued = requested().enqueue()
    expect(queued.prepareForResume()).toBe(queued)
  })
})
