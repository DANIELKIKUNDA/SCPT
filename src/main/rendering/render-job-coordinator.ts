import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import PQueue from 'p-queue'
import type { DeclinaisonAudiovisuelleRepository } from '../../contexts/projects/domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../contexts/projects/domain/repositories/export-audiovisuel.repository'
import type { ProjectSourceVersionPort } from '../../contexts/projects/application/ports/project-source-version.port'
import type { MoteurRenduPort } from '../../contexts/projects/application/ports/moteur-rendu.port'
import { ExportId } from '../../contexts/projects/domain/value-objects/export-id'
import { ProjetAudiovisuelId } from '../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { ProjectRenderPayloadBuilder } from '../../contexts/projects/infrastructure/rendering/project-render-payload-builder'
import { RenderFilesystem, type RenderAttemptPaths } from '../../contexts/projects/infrastructure/rendering/render-filesystem'
import { resolveOfflineRenderBrowser } from '../../contexts/projects/infrastructure/rendering/offline-browser-resolver'
import { logger } from '../logging/logger'

const ACTIVE_STATUSES = [
  'demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification'
] as const

export interface RenderJobCoordinatorContext {
  exports: ExportAudiovisuelRepository
  declinaisons: DeclinaisonAudiovisuelleRepository
  sourceVersions: ProjectSourceVersionPort
  payloadBuilder: ProjectRenderPayloadBuilder
  projectDir: string
}

export interface RenderJobCoordinatorOptions {
  engine: MoteurRenduPort
  contextFor(projectId: string): RenderJobCoordinatorContext
  entryPointFor(): string
  browserExecutableFor(): string
}

function formatLabel(format: string): string {
  if (format === 'VERTICAL_9_16') return '9x16'
  if (format === 'CARRE_1_1') return '1x1'
  return '16x9'
}

function diagnosticOf(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 4000)
  return String(error).slice(0, 4000)
}

export class RenderJobCoordinator {
  private readonly queue = new PQueue({ concurrency: 1 })
  private readonly controllers = new Map<string, AbortController>()
  private readonly projectByJob = new Map<string, string>()
  private readonly activePromises = new Map<string, Promise<void>>()
  private readonly scheduled = new Set<string>()
  private readonly pausedProjects = new Set<string>()
  private shuttingDown = false

  constructor(private readonly options: RenderJobCoordinatorOptions) {}

  schedule(projectId: string, jobId: string): void {
    if (this.shuttingDown || this.pausedProjects.has(projectId) || this.scheduled.has(jobId)) return
    this.scheduled.add(jobId)
    this.projectByJob.set(jobId, projectId)
    const queued = this.queue.add(async () => {
      if (this.shuttingDown || this.pausedProjects.has(projectId)) return
      const promise = this.runJob(projectId, jobId)
      this.activePromises.set(jobId, promise)
      try {
        await promise
      } finally {
        this.activePromises.delete(jobId)
      }
    })
    void queued.finally(() => {
      this.scheduled.delete(jobId)
      this.projectByJob.delete(jobId)
    })
  }

  async recoverProject(projectId: string): Promise<number> {
    this.pausedProjects.delete(projectId)
    const context = this.options.contextFor(projectId)
    const jobs = await context.exports.findByStatuses(
      ProjetAudiovisuelId.from(projectId),
      [...ACTIVE_STATUSES]
    )
    let recovered = 0
    for (const value of jobs) {
      const resumable = value.prepareForResume()
      if (resumable !== value) await context.exports.save(resumable)
      this.schedule(projectId, resumable.id.value)
      recovered += 1
    }
    if (recovered > 0) logger.info({ projectId, recovered }, 'Interrupted render jobs scheduled for recovery')
    return recovered
  }

  async cancel(projectId: string, jobId: string): Promise<boolean> {
    const context = this.options.contextFor(projectId)
    const job = await context.exports.findById(ExportId.from(jobId))
    if (!job || job.projetId.value !== projectId) throw new Error('RENDER_JOB_NOT_FOUND')
    if (job.isTerminal) return false
    await context.exports.save(job.cancel())
    this.controllers.get(jobId)?.abort()
    logger.info({ projectId, jobId }, 'Render cancellation requested')
    return true
  }

  async pauseProject(projectId: string): Promise<void> {
    this.pausedProjects.add(projectId)
    const waits: Promise<void>[] = []
    for (const [jobId, controller] of this.controllers.entries()) {
      if (this.projectByJob.get(jobId) !== projectId) continue
      controller.abort()
      const promise = this.activePromises.get(jobId)
      if (promise) waits.push(promise)
    }
    await Promise.allSettled(waits)
  }

  requestShutdown(): void {
    this.shuttingDown = true
    for (const controller of this.controllers.values()) controller.abort()
    this.queue.clear()
  }

  async shutdown(): Promise<void> {
    this.requestShutdown()
    await Promise.allSettled([...this.activePromises.values()])
  }

  get queuedCount(): number { return this.queue.size }
  get pendingCount(): number { return this.queue.pending }

  async waitForIdle(): Promise<void> {
    await this.queue.onIdle()
  }

  private async runJob(projectId: string, jobId: string): Promise<void> {
    const context = this.options.contextFor(projectId)
    const controller = new AbortController()
    this.controllers.set(jobId, controller)
    let paths: RenderAttemptPaths | null = null
    let progressChain: Promise<void> = Promise.resolve()

    try {
      const loadedJob = await context.exports.findById(ExportId.from(jobId))
      if (!loadedJob || loadedJob.projetId.value !== projectId || !loadedJob.isActive) return
      let job = loadedJob
      if (job.statut === 'demande') {
        job = job.enqueue()
        await context.exports.save(job)
      }
      if (controller.signal.aborted) throw new Error('RENDER_CANCELLED')

      const declinaison = await context.declinaisons.findById(job.declinaisonId)
      if (!declinaison) throw new Error('RENDER_DECLINATION_NOT_FOUND')
      if (declinaison.isObsolete || !declinaison.isReadyForRender) throw new Error('RENDER_DECLINATION_NOT_READY')
      const currentSource = await context.sourceVersions.current(job.projetId)
      if (!currentSource.equals(job.versionsSources.versionProjetSource)) throw new Error('RENDER_SOURCE_OBSOLETE')
      if (!declinaison.version.equals(job.versionsSources.versionDeclinaison)) throw new Error('RENDER_DECLINATION_CHANGED')

      job = job.beginPreparation()
      await context.exports.save(job)
      paths = await new RenderFilesystem(context.projectDir).prepareAttempt({
        jobId: job.id.value,
        attempt: job.tentative,
        formatLabel: formatLabel(declinaison.format.value)
      })
      const fs = new RenderFilesystem(context.projectDir)
      await fs.appendLog(paths.logAbsolutePath, { event: 'preparation', jobId, attempt: job.tentative })

      const inputProps = await context.payloadBuilder.build(declinaison)
      if (controller.signal.aborted) throw new Error('RENDER_CANCELLED')

      job = job.beginComposition()
      await context.exports.save(job)
      await fs.appendLog(paths.logAbsolutePath, { event: 'composition-started' })

      let lastPersistAt = 0
      await this.options.engine.render({
        jobId,
        entryPoint: this.options.entryPointFor(),
        outputPath: paths.temporaryOutput,
        inputProps,
        compositionId: 'SCPTProject',
        browserExecutable: this.options.browserExecutableFor()
      }, {
        signal: controller.signal,
        onProgress: ({ progress }) => {
          const mapped = Math.max(8, Math.min(90, 8 + Math.round(progress * 82)))
          job = job.updateCompositionProgress(mapped)
          const now = Date.now()
          if (now - lastPersistAt >= 500 || mapped >= 90) {
            lastPersistAt = now
            const snapshot = job
            progressChain = progressChain.then(() => context.exports.save(snapshot))
          }
        }
      })
      await progressChain
      if (controller.signal.aborted) throw new Error('RENDER_CANCELLED')

      job = job.beginEncoding()
      await context.exports.save(job)
      await fs.appendLog(paths.logAbsolutePath, { event: 'intermediate-encoded' })

      job = job.beginVerification()
      await context.exports.save(job)
      const committed = await fs.commitTemporaryOutput(paths)
      job = job.complete({ cheminFichier: paths.finalRelativePath, checksum: committed.checksum })
      await context.exports.save(job)
      await fs.appendLog(paths.logAbsolutePath, {
        event: 'completed',
        output: paths.finalRelativePath,
        sizeBytes: committed.sizeBytes,
        checksum: committed.checksum
      })
      logger.info({ projectId, jobId, output: paths.finalRelativePath }, 'Render job completed')
    } catch (error) {
      await progressChain.catch(() => undefined)
      const contextNow = this.options.contextFor(projectId)
      const fresh = await contextNow.exports.findById(ExportId.from(jobId))
      const wasInterrupted = this.shuttingDown || this.pausedProjects.has(projectId)
      const wasCancelled = controller.signal.aborted || diagnosticOf(error) === 'RENDER_CANCELLED'

      if (fresh && !fresh.isTerminal) {
        if (wasInterrupted) {
          await contextNow.exports.save(fresh.prepareForResume())
        } else if (wasCancelled) {
          await contextNow.exports.save(fresh.cancel())
        } else {
          await contextNow.exports.save(fresh.fail(diagnosticOf(error)))
        }
      }
      if (paths) {
        const fs = new RenderFilesystem(context.projectDir)
        await fs.appendLog(paths.logAbsolutePath, {
          event: wasInterrupted ? 'interrupted' : wasCancelled ? 'cancelled' : 'failed',
          diagnostic: diagnosticOf(error)
        }).catch(() => undefined)
      }
      if (!wasCancelled && !wasInterrupted) logger.error({ err: error, projectId, jobId }, 'Render job failed')
    } finally {
      this.controllers.delete(jobId)
      if (paths) await new RenderFilesystem(context.projectDir).cleanupAttempt(paths).catch(() => undefined)
    }
  }
}

export function resolveRemotionEntryPoint(appRoot: string): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? appRoot
  const candidates = [
    resolve(appRoot, 'src', 'remotion', 'index.ts'),
    resolve(resourcesPath, 'remotion', 'index.ts')
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error('RENDER_ENTRY_POINT_MISSING')
  return found
}

export function resolveRenderBrowser(appRoot: string): string {
  return resolveOfflineRenderBrowser({ appRoot })
}
