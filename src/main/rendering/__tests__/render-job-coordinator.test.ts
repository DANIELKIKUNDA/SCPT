import { mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MoteurRenduPort } from '../../../contexts/projects/application/ports/moteur-rendu.port'

// RenderJobCoordinator is a main-process service, but these tests exercise it
// with in-memory repositories and a fake render engine. Do not initialize the
// production Electron logger (which requires electron.app at module load time).
vi.mock('../../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn()
  }
}))

import { DeclinaisonAudiovisuelle } from '../../../contexts/projects/domain/aggregates/declinaison-audiovisuelle'
import { ExportAudiovisuel } from '../../../contexts/projects/domain/aggregates/export-audiovisuel'
import type { DeclinaisonAudiovisuelleRepository } from '../../../contexts/projects/domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../contexts/projects/domain/repositories/export-audiovisuel.repository'
import { DeclinaisonId } from '../../../contexts/projects/domain/value-objects/declinaison-id'
import { FormatVideo } from '../../../contexts/projects/domain/value-objects/format-video'
import { ProfilExport } from '../../../contexts/projects/domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../contexts/projects/domain/value-objects/version-metier'
import type { ProjectRenderPayloadBuilder } from '../../../contexts/projects/infrastructure/rendering/project-render-payload-builder'
import { RenderJobCoordinator } from '../render-job-coordinator'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

const EMPTY_PROPS = {
  scenes: [{
    id: 's1', ordre: 1, type: 'texte' as const, titre: 'Test', texteAffiche: 'Test', dureeMs: 1000,
    composition: { backgroundColor: '#000000', layout: 'centered' as const },
    transition: { type: 'none' as const, durationMs: 0 }, media: null
  }],
  themeId: 'dark' as const,
  reduceMotion: false,
  subtitles: [],
  declination: {
    id: 'd1', format: 'HORIZONTAL_16_9' as const, resolution: { width: 1920, height: 1080 },
    langue: 'fr', profilExport: 'MVP_PREMIUM', overrides: []
  },
  showSafeZone: false
}

function createFixture(engine?: MoteurRenduPort) {
  const root = mkdtempSync(join(tmpdir(), 'scpt-coordinator-'))
  roots.push(root)
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const sourceVersion = VersionMetier.from(2)
  const declinaisons = new Map<string, DeclinaisonAudiovisuelle>()
  const jobs = new Map<string, ExportAudiovisuel>()

  const makeDeclinaison = (id: string) => {
    let value = DeclinaisonAudiovisuelle.create({
      id: DeclinaisonId.from(id), projetId: projectId, format: FormatVideo.from('HORIZONTAL_16_9'),
      langue: 'fr', versionProjetSource: sourceVersion
    })
    value = value.validate(sourceVersion, []).markReadyForRender(sourceVersion)
    declinaisons.set(value.id.value, value)
    return value
  }
  const one = makeDeclinaison('01ARZ3NDEKTSV4RRFFQ69G5FAW')

  const exportRepo: ExportAudiovisuelRepository = {
    save: async (value) => { jobs.set(value.id.value, value) },
    findById: async (id) => jobs.get(id.value) ?? null,
    findAllByProject: async () => [...jobs.values()],
    findActiveByDeclinaison: async (id) => [...jobs.values()].find((job) => job.declinaisonId.equals(id) && job.isActive) ?? null,
    findByStatuses: async (_id, statuses) => [...jobs.values()].filter((job) => statuses.includes(job.statut)),
    maxAttemptForDeclinaison: async (id) => Math.max(0, ...[...jobs.values()].filter((job) => job.declinaisonId.equals(id)).map((job) => job.tentative))
  }
  const declRepo: DeclinaisonAudiovisuelleRepository = {
    save: async (value) => { declinaisons.set(value.id.value, value) },
    findById: async (id) => declinaisons.get(id.value) ?? null,
    findAllByProject: async () => [...declinaisons.values()],
    findCurrentBySignature: async () => one
  }
  const payloadBuilder = { build: async () => EMPTY_PROPS } as unknown as ProjectRenderPayloadBuilder
  const defaultEngine: MoteurRenduPort = {
    async render(request, options) {
      options.onProgress({ progress: 0.2 })
      options.onProgress({ progress: 0.8 })
      await writeFile(request.outputPath, Buffer.from('rendered-video'))
      options.onProgress({ progress: 1 })
      return { outputPath: request.outputPath }
    }
  }
  const coordinator = new RenderJobCoordinator({
    engine: engine ?? defaultEngine,
    contextFor: () => ({
      exports: exportRepo,
      declinaisons: declRepo,
      sourceVersions: { current: () => sourceVersion },
      payloadBuilder,
      projectDir: root
    }),
    entryPointFor: () => join(root, 'entry.ts'),
    browserExecutableFor: () => join(root, 'chrome.exe')
  })

  const createJob = (declinaison = one, status: 'queued' | 'processing' = 'queued') => {
    let job = ExportAudiovisuel.request({
      projetId: projectId,
      declinaisonId: declinaison.id,
      tentative: 1,
      profil: ProfilExport.mvpPremium(),
      versionsSources: { versionProjetSource: sourceVersion, versionDeclinaison: declinaison.version }
    }).enqueue()
    if (status === 'processing') job = job.beginPreparation().beginComposition().updateCompositionProgress(42)
    jobs.set(job.id.value, job)
    return job
  }

  return { root, projectId, one, makeDeclinaison, jobs, coordinator, createJob }
}

describe('RenderJobCoordinator', () => {
  it('renders a queued job to an immutable intermediate output', async () => {
    const f = createFixture()
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await f.coordinator.waitForIdle()
    const done = f.jobs.get(job.id.value)!
    expect(done.statut).toBe('termine')
    expect(done.progression).toBe(100)
    expect(done.cheminFichier).toMatch(/^renders\/previews\//)
    expect(done.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps renderer concurrency at one for two queued jobs', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const engine: MoteurRenduPort = {
      async render(request) {
        concurrent += 1
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 25))
        await writeFile(request.outputPath, 'video')
        concurrent -= 1
        return { outputPath: request.outputPath }
      }
    }
    const f = createFixture(engine)
    const secondDeclinaison = f.makeDeclinaison('01ARZ3NDEKTSV4RRFFQ69G5FAX')
    const one = f.createJob()
    const two = f.createJob(secondDeclinaison)
    f.coordinator.schedule(f.projectId.value, one.id.value)
    f.coordinator.schedule(f.projectId.value, two.id.value)
    await f.coordinator.waitForIdle()
    expect(maxConcurrent).toBe(1)
    expect(f.jobs.get(one.id.value)?.statut).toBe('termine')
    expect(f.jobs.get(two.id.value)?.statut).toBe('termine')
  })

  it('cancels only the requested active render', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolveStarted) => { started = resolveStarted })
    const engine: MoteurRenduPort = {
      async render(_request, options) {
        started()
        await new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('RENDER_CANCELLED')), { once: true })
        })
        throw new Error('unreachable')
      }
    }
    const f = createFixture(engine)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await startedPromise
    expect(await f.coordinator.cancel(f.projectId.value, job.id.value)).toBe(true)
    await f.coordinator.waitForIdle()
    expect(f.jobs.get(job.id.value)?.statut).toBe('annule')
  })

  it('persists a controlled failure without exposing a partial output', async () => {
    const engine: MoteurRenduPort = {
      async render() {
        throw new Error('Synthetic renderer failure')
      }
    }
    const f = createFixture(engine)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await f.coordinator.waitForIdle()
    const failed = f.jobs.get(job.id.value)!
    expect(failed.statut).toBe('echoue')
    expect(failed.cheminFichier).toBeNull()
    expect(failed.checksum).toBeNull()
    expect(failed.diagnostic).toContain('Synthetic renderer failure')
  })

  it('turns an active render into a resumable queued job during graceful shutdown', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolveStarted) => { started = resolveStarted })
    const engine: MoteurRenduPort = {
      async render(_request, options) {
        started()
        await new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('RENDER_CANCELLED')), { once: true })
        })
        throw new Error('unreachable')
      }
    }
    const f = createFixture(engine)
    const job = f.createJob()
    f.coordinator.schedule(f.projectId.value, job.id.value)
    await startedPromise
    await f.coordinator.shutdown()
    const resumable = f.jobs.get(job.id.value)!
    expect(resumable.statut).toBe('en_attente')
    expect(resumable.tentative).toBe(2)
    expect(resumable.progression).toBe(0)
  })

  it('recovers interrupted processing as a new attempt after relaunch', async () => {
    const f = createFixture()
    const interrupted = f.createJob(f.one, 'processing')
    const count = await f.coordinator.recoverProject(f.projectId.value)
    expect(count).toBe(1)
    await f.coordinator.waitForIdle()
    const done = f.jobs.get(interrupted.id.value)!
    expect(done.tentative).toBe(2)
    expect(done.statut).toBe('termine')
  })
})
