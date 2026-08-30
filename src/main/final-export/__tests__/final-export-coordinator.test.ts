import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EncodageVideoPort } from '../../../contexts/projects/application/ports/encodage-video.port'
import type { InspectionMediaPort, MediaInspection } from '../../../contexts/projects/application/ports/inspection-media.port'

vi.mock('../../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
}))

import { DeclinaisonAudiovisuelle } from '../../../contexts/projects/domain/aggregates/declinaison-audiovisuelle'
import { ExportAudiovisuel } from '../../../contexts/projects/domain/aggregates/export-audiovisuel'
import { ExportFinalAudiovisuel } from '../../../contexts/projects/domain/aggregates/export-final-audiovisuel'
import { PisteNarration } from '../../../contexts/projects/domain/aggregates/piste-narration'
import type { DeclinaisonAudiovisuelleRepository } from '../../../contexts/projects/domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../contexts/projects/domain/repositories/export-audiovisuel.repository'
import type { ExportFinalAudiovisuelRepository } from '../../../contexts/projects/domain/repositories/export-final-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../../contexts/projects/domain/repositories/piste-narration.repository'
import { DeclinaisonId } from '../../../contexts/projects/domain/value-objects/declinaison-id'
import { FormatVideo } from '../../../contexts/projects/domain/value-objects/format-video'
import { ProfilExport } from '../../../contexts/projects/domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../contexts/projects/domain/value-objects/version-metier'
import { FinalExportCoordinator } from '../final-export-coordinator'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function validFinalInspection(width = 1920, height = 1080): MediaInspection {
  return {
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2', durationMs: 3000,
    streams: [
      { codecType: 'video', codecName: 'h264', width, height, pixelFormat: 'yuv420p', fps: 30, sampleRate: null, durationMs: 3000 },
      { codecType: 'audio', codecName: 'aac', width: null, height: null, pixelFormat: null, fps: null, sampleRate: 48000, durationMs: 3000 }
    ]
  }
}

function createFixture(encoderOverride?: EncodageVideoPort, failCompletedSave = false) {
  const root = mkdtempSync(join(tmpdir(), 'scpt-final-coordinator-'))
  roots.push(root)
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const sourceVersion = VersionMetier.from(4)
  const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
  let declinaison = DeclinaisonAudiovisuelle.create({
    id: declinaisonId, projetId: projectId, format: FormatVideo.horizontal(), langue: 'fr', versionProjetSource: sourceVersion
  })
  declinaison = declinaison.validate(sourceVersion, []).markReadyForRender(sourceVersion)

  mkdirSync(join(root, 'renders', 'previews'), { recursive: true })
  mkdirSync(join(root, 'audio', 'narration'), { recursive: true })
  const videoRelative = 'renders/previews/source.mp4'
  const audioRelative = 'audio/narration/final.wav'
  writeFileSync(join(root, videoRelative), 'phase9-video')
  writeFileSync(join(root, audioRelative), 'phase6-audio')
  const videoChecksum = sha('phase9-video')
  const audioChecksum = sha('phase6-audio')

  const render = ExportAudiovisuel.request({
    projetId: projectId, declinaisonId, tentative: 1, profil: ProfilExport.mvpPremium(),
    versionsSources: { versionProjetSource: sourceVersion, versionDeclinaison: declinaison.version }
  }).enqueue().beginPreparation().beginComposition().beginVerification().complete({
    cheminFichier: videoRelative, checksum: videoChecksum
  })

  let narration = PisteNarration.create({ projetId: projectId, langue: 'fr' })
  narration = narration.addTake({
    texte: 'Narration', fichierAudio: audioRelative, dureeMs: 3000, statut: 'generee', source: 'piper', checksum: audioChecksum
  })
  narration = narration.selectFinalTake(narration.segments[0].id)

  const jobs = new Map<string, ExportFinalAudiovisuel>()
  const finalRepo: ExportFinalAudiovisuelRepository = {
    save: async (value) => {
      if (failCompletedSave && value.statut === 'termine') throw new Error('Synthetic persistence failure')
      jobs.set(value.id.value, value)
    },
    findById: async (id) => jobs.get(id.value) ?? null,
    findAllByProject: async () => [...jobs.values()],
    findActiveByRenderJob: async (id) => [...jobs.values()].find((value) => value.renderJobId.equals(id) && value.isActive) ?? null,
    findByStatuses: async (_id, statuses) => [...jobs.values()].filter((value) => statuses.includes(value.statut)),
    maxAttemptForRenderJob: async (id) => Math.max(0, ...[...jobs.values()].filter((value) => value.renderJobId.equals(id)).map((value) => value.tentative))
  }
  const renderRepo: ExportAudiovisuelRepository = {
    save: async () => undefined,
    findById: async (id) => id.equals(render.id) ? render : null,
    findAllByProject: async () => [render],
    findActiveByDeclinaison: async () => null,
    findByStatuses: async () => [],
    maxAttemptForDeclinaison: async () => 1
  }
  const declRepo: DeclinaisonAudiovisuelleRepository = {
    save: async () => undefined,
    findById: async (id) => id.equals(declinaison.id) ? declinaison : null,
    findAllByProject: async () => [declinaison],
    findCurrentBySignature: async () => declinaison
  }
  const narrationRepo: PisteNarrationRepository = {
    save: async (value) => { narration = value },
    findById: async () => narration,
    findByProject: async () => narration
  }
  const inspector: InspectionMediaPort = {
    inspect: async (filePath) => {
      if (filePath.endsWith('.wav')) {
        return {
          formatName: 'wav', durationMs: 3000,
          streams: [{ codecType: 'audio', codecName: 'pcm_s16le', width: null, height: null, pixelFormat: null, fps: null, sampleRate: 22050, durationMs: 3000 }]
        }
      }
      return validFinalInspection()
    }
  }
  const defaultEncoder: EncodageVideoPort = {
    async encodeFinal(request, options) {
      await options.onProgress(0.25)
      await options.onProgress(0.75)
      await writeFile(request.outputPath, 'verified-final-video')
      await options.onProgress(1)
      return {
        outputPath: request.outputPath,
        loudness: { inputI: -22, inputTp: -3, inputLra: 2, inputThresh: -32, targetOffset: 0 }
      }
    }
  }
  const coordinator = new FinalExportCoordinator({
    encoder: encoderOverride ?? defaultEncoder,
    inspector,
    contextFor: () => ({
      finalExports: finalRepo, renders: renderRepo, declinaisons: declRepo, narrations: narrationRepo,
      sourceVersions: { current: async () => sourceVersion }, projectDir: root, projectTitle: 'Cours Logarithmes'
    })
  })

  function createJob(status: 'queued' | 'processing' = 'queued'): ExportFinalAudiovisuel {
    let job = ExportFinalAudiovisuel.request({
      projetId: projectId, renderJobId: render.id, declinaisonId, tentative: 1,
      profil: render.profil, sourceRenderChecksum: videoChecksum,
      narrationTakeId: narration.priseFinale!.id, narrationChecksum: audioChecksum
    }).enqueue()
    if (status === 'processing') job = job.beginPreparation().beginEncoding().updateEncodingProgress(45)
    jobs.set(job.id.value, job)
    return job
  }

  return { root, projectId, render, jobs, coordinator, createJob }
}

describe('FinalExportCoordinator', () => {
  it('produces and persists one verified immutable final MP4', async () => {
    const f = createFixture()
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await f.coordinator.waitForIdle()
    const done = f.jobs.get(job.id.value)!
    expect(done.statut).toBe('termine')
    expect(done.progression).toBe(100)
    expect(done.technique?.cheminFichier).toMatch(/^renders\/final\//)
    expect(done.technique?.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(done.technique?.codecAudio).toBe('aac')
  })

  it('keeps final encoding concurrency at one', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const encoder: EncodageVideoPort = {
      async encodeFinal(request) {
        concurrent += 1
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 25))
        await writeFile(request.outputPath, `video-${Date.now()}`)
        concurrent -= 1
        return { outputPath: request.outputPath, loudness: { inputI: -20, inputTp: -2, inputLra: 1, inputThresh: -30, targetOffset: 0 } }
      }
    }
    const f = createFixture(encoder)
    const one = f.createJob()
    const two = ExportFinalAudiovisuel.request({
      projetId: one.projetId, renderJobId: one.renderJobId, declinaisonId: one.declinaisonId, tentative: 2,
      profil: one.profil, sourceRenderChecksum: one.sourceRenderChecksum,
      narrationTakeId: one.narrationTakeId, narrationChecksum: one.narrationChecksum
    }).enqueue()
    f.jobs.set(two.id.value, two)
    f.coordinator.schedule(f.projectId.value, one.id.value)
    f.coordinator.schedule(f.projectId.value, two.id.value)
    await f.coordinator.waitForIdle()
    expect(maxConcurrent).toBe(1)
    expect(f.jobs.get(one.id.value)?.statut).toBe('termine')
    expect(f.jobs.get(two.id.value)?.statut).toBe('termine')
  })

  it('cancels only the requested active FFmpeg export', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    const encoder: EncodageVideoPort = {
      async encodeFinal(_request, options) {
        started()
        await new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('FINAL_EXPORT_CANCELLED')), { once: true })
        })
        throw new Error('unreachable')
      }
    }
    const f = createFixture(encoder)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await startedPromise
    expect(await f.coordinator.cancel(f.projectId.value, job.id.value)).toBe(true)
    await f.coordinator.waitForIdle()
    expect(f.jobs.get(job.id.value)?.statut).toBe('annule')
    expect(f.jobs.get(job.id.value)?.technique).toBeNull()
  })

  it('persists an encoding failure without exposing a final file', async () => {
    const encoder: EncodageVideoPort = {
      async encodeFinal() { throw new Error('Synthetic FFmpeg failure') }
    }
    const f = createFixture(encoder)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await f.coordinator.waitForIdle()
    const failed = f.jobs.get(job.id.value)!
    expect(failed.statut).toBe('echoue')
    expect(failed.technique).toBeNull()
    expect(failed.diagnostic).toContain('Synthetic FFmpeg failure')
  })

  it('turns active encoding into a resumable queued job on graceful shutdown', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    const encoder: EncodageVideoPort = {
      async encodeFinal(_request, options) {
        started()
        await new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('FINAL_EXPORT_CANCELLED')), { once: true })
        })
        throw new Error('unreachable')
      }
    }
    const f = createFixture(encoder)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await startedPromise
    await f.coordinator.shutdown()
    const resumable = f.jobs.get(job.id.value)!
    expect(resumable.statut).toBe('en_attente')
    expect(resumable.tentative).toBe(2)
    expect(resumable.progression).toBe(0)
  })

  it('recovers interrupted final encoding as a new successful attempt', async () => {
    const f = createFixture()
    const interrupted = f.createJob('processing')
    const recovered = await f.coordinator.recoverProject(f.projectId.value)
    expect(recovered).toBe(1)
    await f.coordinator.waitForIdle()
    const done = f.jobs.get(interrupted.id.value)!
    expect(done.tentative).toBe(2)
    expect(done.statut).toBe('termine')
  })

  it('removes a committed file if completion metadata cannot be persisted', async () => {
    const f = createFixture(undefined, true)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await f.coordinator.waitForIdle()
    const failed = f.jobs.get(job.id.value)!
    expect(failed.statut).toBe('echoue')
    expect(failed.technique).toBeNull()
    const finalDir = join(f.root, 'renders', 'final')
    const { readdirSync } = await import('node:fs')
    expect(readdirSync(finalDir)).toEqual([])
  })

})
