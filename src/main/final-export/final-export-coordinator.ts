import PQueue from 'p-queue'
import type { EncodageVideoPort } from '../../contexts/projects/application/ports/encodage-video.port'
import type { InspectionMediaPort } from '../../contexts/projects/application/ports/inspection-media.port'
import type { ProjectSourceVersionPort } from '../../contexts/projects/application/ports/project-source-version.port'
import type { DeclinaisonAudiovisuelleRepository } from '../../contexts/projects/domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../contexts/projects/domain/repositories/export-audiovisuel.repository'
import type { ExportFinalAudiovisuelRepository } from '../../contexts/projects/domain/repositories/export-final-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../contexts/projects/domain/repositories/piste-narration.repository'
import { ExportId } from '../../contexts/projects/domain/value-objects/export-id'
import { ProjetAudiovisuelId } from '../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { FinalExportFilesystem, type FinalExportAttemptPaths } from '../../contexts/projects/infrastructure/final-export/final-export-filesystem'
import { FinalExportInputBuilder } from '../../contexts/projects/infrastructure/final-export/final-export-input-builder'
import { verifyFinalMedia } from '../../contexts/projects/infrastructure/final-export/final-media-verifier'
import { logger } from '../logging/logger'

const ACTIVE_STATUSES = ['demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification'] as const

export interface FinalExportCoordinatorContext {
  finalExports: ExportFinalAudiovisuelRepository
  renders: ExportAudiovisuelRepository
  declinaisons: DeclinaisonAudiovisuelleRepository
  narrations: PisteNarrationRepository
  sourceVersions: ProjectSourceVersionPort
  projectDir: string
  projectTitle: string
}

export interface FinalExportCoordinatorOptions {
  encoder: EncodageVideoPort
  inspector: InspectionMediaPort
  contextFor(projectId: string): FinalExportCoordinatorContext
}

function diagnosticOf(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000)
}

export class FinalExportCoordinator {
  private readonly queue = new PQueue({ concurrency: 1 })
  private readonly controllers = new Map<string, AbortController>()
  private readonly projectByExport = new Map<string, string>()
  private readonly activePromises = new Map<string, Promise<void>>()
  private readonly scheduled = new Set<string>()
  private readonly pausedProjects = new Set<string>()
  private shuttingDown = false

  constructor(private readonly options: FinalExportCoordinatorOptions) {}

  schedule(projectId: string, exportId: string): void {
    if (this.shuttingDown || this.pausedProjects.has(projectId) || this.scheduled.has(exportId)) return
    this.scheduled.add(exportId)
    this.projectByExport.set(exportId, projectId)
    const queued = this.queue.add(async () => {
      if (this.shuttingDown || this.pausedProjects.has(projectId)) return
      const promise = this.runExport(projectId, exportId)
      this.activePromises.set(exportId, promise)
      try {
        await promise
      } finally {
        this.activePromises.delete(exportId)
      }
    })
    void queued.finally(() => {
      this.scheduled.delete(exportId)
      this.projectByExport.delete(exportId)
    })
  }

  async recoverProject(projectId: string): Promise<number> {
    this.pausedProjects.delete(projectId)
    const context = this.options.contextFor(projectId)
    const items = await context.finalExports.findByStatuses(ProjetAudiovisuelId.from(projectId), [...ACTIVE_STATUSES])
    let recovered = 0
    for (const value of items) {
      const resumable = value.prepareForResume()
      if (resumable !== value) await context.finalExports.save(resumable)
      this.schedule(projectId, resumable.id.value)
      recovered += 1
    }
    if (recovered > 0) logger.info({ projectId, recovered }, 'Interrupted final exports scheduled for recovery')
    return recovered
  }

  async cancel(projectId: string, exportId: string): Promise<boolean> {
    const context = this.options.contextFor(projectId)
    const item = await context.finalExports.findById(ExportId.from(exportId))
    if (!item || item.projetId.value !== projectId) throw new Error('FINAL_EXPORT_NOT_FOUND')
    if (item.isTerminal) return false
    await context.finalExports.save(item.cancel())
    this.controllers.get(exportId)?.abort()
    logger.info({ projectId, exportId }, 'Final export cancellation requested')
    return true
  }

  async pauseProject(projectId: string): Promise<void> {
    this.pausedProjects.add(projectId)
    const waits: Promise<void>[] = []
    for (const [exportId, controller] of this.controllers.entries()) {
      if (this.projectByExport.get(exportId) !== projectId) continue
      controller.abort()
      const promise = this.activePromises.get(exportId)
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

  private async runExport(projectId: string, exportIdValue: string): Promise<void> {
    const context = this.options.contextFor(projectId)
    const controller = new AbortController()
    this.controllers.set(exportIdValue, controller)
    let paths: FinalExportAttemptPaths | null = null
    let committedRelativePath: string | null = null
    let completionPersisted = false
    let progressChain: Promise<void> = Promise.resolve()
    const files = new FinalExportFilesystem(context.projectDir)

    try {
      const loaded = await context.finalExports.findById(ExportId.from(exportIdValue))
      if (!loaded || loaded.projetId.value !== projectId || !loaded.isActive) return
      let current = loaded
      if (current.statut === 'demande') {
        current = current.enqueue()
        await context.finalExports.save(current)
      }
      if (controller.signal.aborted) throw new Error('FINAL_EXPORT_CANCELLED')

      current = current.beginPreparation()
      await context.finalExports.save(current)
      const input = await new FinalExportInputBuilder(
        context.projectDir,
        context.renders,
        context.declinaisons,
        context.narrations,
        context.sourceVersions,
        this.options.inspector
      ).build(current, controller.signal)

      paths = await files.prepareAttempt({
        exportId: current.id.value,
        attempt: current.tentative,
        projectTitle: context.projectTitle,
        formatLabel: input.formatLabel
      })
      await files.assertSufficientDiskSpace({
        sourceVideo: input.videoInputPath,
        sourceAudio: input.audioInputPath,
        destinationDir: paths.attemptDir
      })
      await files.appendLog(paths.logAbsolutePath, {
        event: 'preparation', exportId: current.id.value, attempt: current.tentative,
        renderJobId: current.renderJobId.value, sourceRenderChecksum: current.sourceRenderChecksum,
        narrationTakeId: current.narrationTakeId, narrationChecksum: current.narrationChecksum
      })

      current = current.beginEncoding()
      await context.finalExports.save(current)
      let lastPersistAt = 0
      await this.options.encoder.encodeFinal({
        videoInputPath: input.videoInputPath,
        audioInputPath: input.audioInputPath,
        outputPath: paths.temporaryOutput,
        expectedDurationMs: input.expectedDurationMs,
        width: input.width,
        height: input.height
      }, {
        signal: controller.signal,
        onProgress: (value) => {
          const mapped = 10 + Math.round(Math.min(1, Math.max(0, value)) * 82)
          current = current.updateEncodingProgress(mapped)
          const now = Date.now()
          if (now - lastPersistAt >= 500 || mapped >= 92) {
            lastPersistAt = now
            const snapshot = current
            progressChain = progressChain.then(() => context.finalExports.save(snapshot))
          }
        }
      })
      await progressChain
      if (controller.signal.aborted) throw new Error('FINAL_EXPORT_CANCELLED')

      current = current.beginVerification()
      await context.finalExports.save(current)
      await files.appendLog(paths.logAbsolutePath, { event: 'verification-started' })
      const inspection = await this.options.inspector.inspect(paths.temporaryOutput, controller.signal)
      const verified = verifyFinalMedia(inspection, {
        width: input.width,
        height: input.height,
        durationMs: input.expectedDurationMs
      })
      const committed = await files.commitVerifiedOutput(paths)
      committedRelativePath = paths.finalRelativePath
      current = current.complete({
        nomFichier: paths.finalFileName,
        cheminFichier: paths.finalRelativePath,
        checksum: committed.checksum,
        tailleOctets: committed.sizeBytes,
        ...verified
      })
      await context.finalExports.save(current)
      completionPersisted = true
      await files.appendLog(paths.logAbsolutePath, {
        event: 'completed', output: paths.finalRelativePath, checksum: committed.checksum,
        sizeBytes: committed.sizeBytes, durationMs: verified.dureeMs,
        video: `${verified.codecVideo}/${verified.pixelFormat}/${verified.largeur}x${verified.hauteur}@${verified.fps}`,
        audio: `${verified.codecAudio}@${verified.audioSampleRate}`
      })
      logger.info({ projectId, exportId: exportIdValue, output: paths.finalRelativePath }, 'Final export completed')
    } catch (error) {
      await progressChain.catch(() => undefined)
      const contextNow = this.options.contextFor(projectId)
      const fresh = await contextNow.finalExports.findById(ExportId.from(exportIdValue))
      const wasInterrupted = this.shuttingDown || this.pausedProjects.has(projectId)
      const wasCancelled = controller.signal.aborted || diagnosticOf(error) === 'FINAL_EXPORT_CANCELLED'
      if (committedRelativePath && !completionPersisted) {
        // A final file is only authoritative after its verified metadata is
        // durably persisted. If that persistence step fails, remove the just
        // committed file so a retry cannot be blocked by an orphan output.
        await files.removeFinal(committedRelativePath).catch(() => undefined)
      }
      if (fresh && !fresh.isTerminal) {
        if (wasInterrupted) await contextNow.finalExports.save(fresh.prepareForResume())
        else if (wasCancelled) await contextNow.finalExports.save(fresh.cancel())
        else await contextNow.finalExports.save(fresh.fail(diagnosticOf(error)))
      }
      if (paths) {
        await files.appendLog(paths.logAbsolutePath, {
          event: wasInterrupted ? 'interrupted' : wasCancelled ? 'cancelled' : 'failed',
          diagnostic: diagnosticOf(error)
        }).catch(() => undefined)
      }
      if (!wasInterrupted && !wasCancelled) logger.error({ err: error, projectId, exportId: exportIdValue }, 'Final export failed')
    } finally {
      this.controllers.delete(exportIdValue)
      if (paths) await files.cleanupAttempt(paths).catch(() => undefined)
    }
  }
}
