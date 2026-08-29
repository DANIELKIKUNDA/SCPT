import { ipcMain, app, dialog } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import { ipcSuccess, ipcFailure } from '../../shared/types/ipc'
import { ErrorCodes } from '../../shared/errors/error-codes'
import { logger } from '../logging/logger'
import { getAllPreferences, setPreferences } from '../preferences/store'
import {
  PreferenceKeySchema,
  PartialPreferencesSchema
} from '../../shared/validation/preferences-schema'

import { createSqliteProjectRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-project-repository'
import { CreateProjectUseCase } from '../../contexts/projects/application/use-cases/create-project.use-case'
import { OpenProjectUseCase } from '../../contexts/projects/application/use-cases/open-project.use-case'
import { ListRecentUseCase } from '../../contexts/projects/application/use-cases/list-recent.use-case'
import { ArchiveProjectUseCase } from '../../contexts/projects/application/use-cases/archive-project.use-case'
import { RestoreProjectUseCase } from '../../contexts/projects/application/use-cases/restore-project.use-case'
import { getLockManager, ProjectLockedError } from '../persistence/lock-manager'
import { join } from 'path'
import { ProjetAudiovisuelId } from '../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { getProjectManifestService } from '../persistence/project-manifest'
import { createDrizzleSceneRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-scene-repository'
import { SceneId } from '../../contexts/projects/domain/value-objects/scene-id'
import { SCENE_TYPES } from '../../contexts/projects/domain/value-objects/scene-type'
import { LoadSequenceUseCase } from '../../contexts/projects/application/use-cases/scene/load-sequence.use-case'
import { CreateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/create-scene.use-case'
import { UpdateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/update-scene.use-case'
import { DeleteSceneUseCase } from '../../contexts/projects/application/use-cases/scene/delete-scene.use-case'
import { DuplicateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/duplicate-scene.use-case'
import { ReorderScenesUseCase } from '../../contexts/projects/application/use-cases/scene/reorder-scenes.use-case'

import { createDrizzleMediaRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-media-repository'
import { ImportMediaUseCase } from '../../contexts/projects/application/use-cases/media/import-media.use-case'
import { executeMediaImport } from './media-import.handler'
import { RessourceMediaId } from '../../contexts/projects/domain/value-objects/ressource-media-id'
import { RessourceMedia } from '../../contexts/projects/domain/aggregates/ressource-media'
import { MediaWatcher, verifyMediaFiles } from '../persistence/media-watcher'
import { toMediaPreviewUrl } from '../protocols/media-protocol'
import { createDrizzleNarrationRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-narration-repository'
import { GetNarrationTrackUseCase } from '../../contexts/projects/application/use-cases/narration/get-narration-track.use-case'
import { GenerateNarrationUseCase } from '../../contexts/projects/application/use-cases/narration/generate-narration.use-case'
import { ImportNarrationUseCase } from '../../contexts/projects/application/use-cases/narration/import-narration.use-case'
import { SelectFinalNarrationTakeUseCase } from '../../contexts/projects/application/use-cases/narration/select-final-take.use-case'
import { ReadNarrationAudioUseCase } from '../../contexts/projects/application/use-cases/narration/read-narration-audio.use-case'
import { NarrationFilesystem } from '../../contexts/projects/infrastructure/narration/narration-filesystem'
import { PiperGenerationAdapter, defaultFrenchVoice, defaultPiperExecutable } from '../../contexts/projects/infrastructure/narration/piper-generation-adapter'
import type { PisteNarration } from '../../contexts/projects/domain/aggregates/piste-narration'
import { createDrizzleSubtitleRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-subtitle-repository'
import { GetSubtitleTrackUseCase } from '../../contexts/projects/application/use-cases/subtitles/get-subtitle-track.use-case'
import { SynchronizeSubtitlesUseCase } from '../../contexts/projects/application/use-cases/subtitles/synchronize-subtitles.use-case'
import { UpdateSubtitleSegmentUseCase } from '../../contexts/projects/application/use-cases/subtitles/update-subtitle-segment.use-case'
import { AddSubtitleSegmentUseCase } from '../../contexts/projects/application/use-cases/subtitles/add-subtitle-segment.use-case'
import { DeleteSubtitleSegmentUseCase } from '../../contexts/projects/application/use-cases/subtitles/delete-subtitle-segment.use-case'
import { ValidateSubtitleTrackUseCase } from '../../contexts/projects/application/use-cases/subtitles/validate-subtitle-track.use-case'
import { MarkSubtitlesResyncUseCase } from '../../contexts/projects/application/use-cases/subtitles/mark-subtitles-resync.use-case'
import { ExportSubtitlesUseCase } from '../../contexts/projects/application/use-cases/subtitles/export-subtitles.use-case'
import { SubtitleFilesystem } from '../../contexts/projects/infrastructure/subtitles/subtitle-filesystem'
import type { PisteSousTitres } from '../../contexts/projects/domain/aggregates/piste-sous-titres'

import { createDrizzleDeclinaisonRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-declinaison-repository'
import { createProjectSourceVersionAdapter } from '../../contexts/projects/infrastructure/persistence/project-source-version-adapter'
import { CreateDeclinaisonUseCase } from '../../contexts/projects/application/use-cases/declinaisons/create-declinaison.use-case'
import { ListDeclinaisonsUseCase } from '../../contexts/projects/application/use-cases/declinaisons/list-declinaisons.use-case'
import { SetDeclinaisonOverrideUseCase } from '../../contexts/projects/application/use-cases/declinaisons/set-declinaison-override.use-case'
import { RemoveDeclinaisonOverrideUseCase } from '../../contexts/projects/application/use-cases/declinaisons/remove-declinaison-override.use-case'
import { ValidateDeclinaisonUseCase } from '../../contexts/projects/application/use-cases/declinaisons/validate-declinaison.use-case'
import { MarkDeclinaisonReadyUseCase } from '../../contexts/projects/application/use-cases/declinaisons/mark-declinaison-ready.use-case'
import type { DeclinaisonAudiovisuelle } from '../../contexts/projects/domain/aggregates/declinaison-audiovisuelle'
import type { ExportAudiovisuel } from '../../contexts/projects/domain/aggregates/export-audiovisuel'
import { ExportId } from '../../contexts/projects/domain/value-objects/export-id'
import { createDrizzleExportRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-export-repository'
import { RequestRenderUseCase } from '../../contexts/projects/application/use-cases/rendering/request-render.use-case'
import { ListRenderJobsUseCase } from '../../contexts/projects/application/use-cases/rendering/list-render-jobs.use-case'
import { RetryRenderUseCase } from '../../contexts/projects/application/use-cases/rendering/retry-render.use-case'
import { ProjectRenderPayloadBuilder } from '../../contexts/projects/infrastructure/rendering/project-render-payload-builder'
import { RenderFilesystem } from '../../contexts/projects/infrastructure/rendering/render-filesystem'
import { RemotionRenderAdapter } from '../../contexts/projects/infrastructure/rendering/remotion-render-adapter'
import {
  RenderJobCoordinator,
  resolveRemotionEntryPoint,
  resolveRenderBrowser
} from '../rendering/render-job-coordinator'

let repo: ReturnType<typeof createSqliteProjectRepository> | null = null

function getProjectRepo(): ReturnType<typeof createSqliteProjectRepository> {
  if (!repo) {
    const dbPath = join(app.getPath('userData'), 'scpt-catalog.sqlite')
    logger.info({ dbPath }, 'Opening SQLite catalog')
    repo = createSqliteProjectRepository(dbPath)
  }
  return repo
}


const SceneCompositionInputSchema = z.object({
  backgroundColor: z.string().min(1).max(64),
  layout: z.enum(['centered', 'top', 'split-left', 'split-right'])
})

const SceneTransitionInputSchema = z.object({
  type: z.enum(['fade', 'slide-left', 'slide-right', 'none']),
  durationMs: z.number().int().min(0).max(5000)
})

const SceneCreateInputSchema = z.object({
  projetId: z.string().min(1),
  type: z.enum(SCENE_TYPES),
  titre: z.string().max(300).nullable().optional(),
  narrationTexte: z.string().max(20000).nullable().optional(),
  texteAffiche: z.string().max(20000).nullable().optional(),
  dureeMs: z.number().int().positive().max(300000).optional()
})

const SceneUpdateInputSchema = z.object({
  sceneId: z.string().min(1),
  projetId: z.string().min(1),
  titre: z.string().max(300).nullable().optional(),
  narrationTexte: z.string().max(20000).nullable().optional(),
  texteAffiche: z.string().max(20000).nullable().optional(),
  dureeMs: z.number().int().positive().max(300000).optional(),
  composition: SceneCompositionInputSchema.optional(),
  transition: SceneTransitionInputSchema.optional()
})

export function registerIpcHandlers(): void {
  let _createProject: CreateProjectUseCase
  let _openProject: OpenProjectUseCase
  let _listRecent: ListRecentUseCase
  let _archiveProject: ArchiveProjectUseCase
  let _restoreProject: RestoreProjectUseCase

  const ensureRepo = () => {
    const r = getProjectRepo()
    const lm = getLockManager()
    _createProject ??= new CreateProjectUseCase(r)
    _openProject ??= new OpenProjectUseCase(r, lm)
    _listRecent ??= new ListRecentUseCase(r)
    _archiveProject ??= new ArchiveProjectUseCase(r)
    _restoreProject ??= new RestoreProjectUseCase(r)
  }
  
  // Phase 1 handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_PING, () => {
    logger.debug('system:ping received')
    try {
      return ipcSuccess({ message: 'pong' as const, timestamp: Date.now() })
    } catch (err) {
      logger.error({ err }, 'system:ping failed')
      return ipcFailure(ErrorCodes.INTERNAL_ERROR, 'Ping failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_APP_INFO, () => {
    logger.debug('system:get-app-info received')
    try {
      const data = {
        name: app.getName(),
        version: app.getVersion(),
        electronVersion: process.versions.electron ?? 'unknown',
        isDev: !app.isPackaged
      }
      return ipcSuccess(data)
    } catch (err) {
      logger.error({ err }, 'system:get-app-info failed')
      return ipcFailure(ErrorCodes.INTERNAL_ERROR, 'Failed to get app info')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, (_event, key: unknown) => {
    const parsed = PreferenceKeySchema.safeParse(key)
    if (!parsed.success) {
      logger.warn({ key, issues: parsed.error.issues }, 'preferences:get invalid key')
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid preference key')
    }

    try {
      const prefs = getAllPreferences()
      return ipcSuccess({ key: parsed.data, value: prefs[parsed.data] })
    } catch (err) {
      logger.error({ err }, 'preferences:get failed')
      return ipcFailure(ErrorCodes.PREFERENCE_ERROR, 'Failed to read preference')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, (_event, partial: unknown) => {
    const parsed = PartialPreferencesSchema.safeParse(partial)
    if (!parsed.success) {
      logger.warn({ partial, issues: parsed.error.issues }, 'preferences:set invalid data')
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid preference data')
    }

    try {
      const updated = setPreferences(parsed.data)
      return ipcSuccess(updated)
    } catch (err) {
      logger.error({ err }, 'preferences:set failed')
      return ipcFailure(ErrorCodes.PREFERENCE_ERROR, 'Failed to write preference')
    }
  })

  // Phase 2 handlers
  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, async (_event, input: unknown) => {
    ensureRepo()
    logger.info('projects:create received')
    try {
      const projet = await _createProject.execute(input)
      return ipcSuccess({
        id: projet.id.value,
        titre: projet.titre,
        type: projet.type,
        statut: projet.statut,
        createdAt: projet.createdAt.toISOString()
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ err, input }, 'projects:create failed')
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_OPEN, async (_event, projectId: unknown) => {
    logger.info({ projectId }, 'projects:open received')
    try {
      if (typeof projectId !== 'string') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      }
      ensureRepo()
      const projet = await _openProject.execute(projectId)

      // Start media watcher for this project
      const projectDir = join(app.getPath('userData'), 'projects', projectId)
      mediaWatcher.startWatching(projectId, projectDir)

      // Verify all media files on project open
      try {
        const mediaRepo = createDrizzleMediaRepository(getProjectManifestService().getDatabasePath(projectId))
        try {
          const medias = await mediaRepo.findAll(ProjetAudiovisuelId.from(projectId))
          const missingPaths = verifyMediaFiles(projectDir, medias.filter(m => m.isDisponible).map(m => m.cheminRelatif))
          for (const path of missingPaths) {
            const media = medias.find(m => m.cheminRelatif === path)
            if (media) {
              const updated = media.marquerManquante()
              await mediaRepo.save(updated)
              logger.info({ mediaId: updated.id.value }, 'Media marked as missing on project open')
            }
          }
        } finally {
          mediaRepo.close()
        }
      } catch (e) {
        logger.warn({ err: e }, 'Media verification on project open failed (non-blocking)')
      }

      // Phase 9: reopening a project schedules interrupted renders immediately.
      // Recovery remains non-blocking for project access: a render subsystem issue
      // must not make an otherwise healthy project impossible to open.
      try {
        await ensureRenderRecovery(projectId)
      } catch (error) {
        logger.warn({ err: error, projectId }, 'Render recovery on project open failed (non-blocking)')
      }

      return ipcSuccess({
        id: projet.id.value,
        titre: projet.titre,
        type: projet.type,
        objectif: projet.objectif,
        publicCible: projet.publicCible,
        langueSource: projet.langueSource,
        statut: projet.statut,
        version: projet.version,
        createdAt: projet.createdAt.toISOString(),
        updatedAt: projet.updatedAt.toISOString(),
        isArchived: projet.isArchived
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (err instanceof ProjectLockedError) {
        logger.warn({ projectId }, 'Project locked')
        return ipcFailure(ErrorCodes.IPC_ERROR, message)
      }
      logger.error({ err, projectId }, 'projects:open failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CLOSE, async (_event, projectId: unknown) => {
    logger.info({ projectId }, 'projects:close received')
    try {
      if (typeof projectId !== 'string') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      }
      if (renderCoordinator) await renderCoordinator.pauseProject(projectId)
      await getLockManager().releaseLock(projectId)
      mediaWatcher.stopWatching(projectId)
      sceneRepos.get(projectId)?.close()
      sceneRepos.delete(projectId)
      mediaRepos.get(projectId)?.close()
      mediaRepos.delete(projectId)
      narrationControllers.get(projectId)?.abort()
      narrationControllers.delete(projectId)
      narrationRepos.get(projectId)?.close()
      narrationRepos.delete(projectId)
      subtitleRepos.get(projectId)?.close()
      subtitleRepos.delete(projectId)
      declinaisonRepos.get(projectId)?.close()
      declinaisonRepos.delete(projectId)
      sourceVersionAdapters.get(projectId)?.close()
      sourceVersionAdapters.delete(projectId)
      renderRepos.get(projectId)?.close()
      renderRepos.delete(projectId)
      renderRecoveryPerformed.delete(projectId)
      return ipcSuccess({ released: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ err, projectId }, 'projects:close failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST_RECENT, async () => {
    logger.info('projects:list-recent received')
    try {
      ensureRepo()
      const projects = await _listRecent.execute(10)
      return ipcSuccess(
        projects.map((p: { id: { value: string }; titre: string; type: string; statut: string; updatedAt: Date; isArchived: boolean }) => ({
          id: p.id.value,
          titre: p.titre,
          type: p.type,
          statut: p.statut,
          updatedAt: p.updatedAt.toISOString(),
          isArchived: p.isArchived
        }))
      )
    } catch (err) {
      logger.error({ err }, 'projects:list-recent failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, 'Failed to list projects')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_ARCHIVE, async (_event, projectId: unknown) => {
    logger.info({ projectId }, 'projects:archive received')
    try {
      if (typeof projectId !== 'string') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      }
      ensureRepo()
      const projet = await _archiveProject.execute(projectId)
      return ipcSuccess({
        id: projet.id.value,
        statut: projet.statut,
        archivedAt: projet.archivedAt?.toISOString() ?? null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ err, projectId }, 'projects:archive failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_RESTORE, async (_event, projectId: unknown) => {
    logger.info({ projectId }, 'projects:restore received')
    try {
      if (typeof projectId !== 'string') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      }
      ensureRepo()
      const projet = await _restoreProject.execute(projectId)
      return ipcSuccess({
        id: projet.id.value,
        statut: projet.statut
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ err, projectId }, 'projects:restore failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })

  // Phase 3: Scene handlers
  const sceneRepos = new Map<string, ReturnType<typeof createDrizzleSceneRepository>>()

  function getSceneRepo(projectId: string): ReturnType<typeof createDrizzleSceneRepository> {
    let sr = sceneRepos.get(projectId)
    if (!sr) {
      const dbPath = getProjectManifestService().getDatabasePath(projectId)
      sr = createDrizzleSceneRepository(dbPath)
      sceneRepos.set(projectId, sr)
    }
    return sr
  }

  async function serializeScene(
    sceneRepo: ReturnType<typeof createDrizzleSceneRepository>,
    scene: Awaited<ReturnType<LoadSequenceUseCase['execute']>>[number]
  ) {
    return {
      id: scene.id.value,
      projetId: scene.projetId.value,
      ordre: scene.ordre,
      type: scene.type,
      titre: scene.titre,
      narrationTexte: scene.narrationTexte,
      texteAffiche: scene.texteAffiche,
      dureeMs: scene.dureeMs,
      composition: scene.composition,
      transition: scene.transition,
      mediaId: await sceneRepo.getMediaId(scene.id)
    }
  }

  ipcMain.handle(IPC_CHANNELS.SCENES_LOAD_SEQUENCE, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string') return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      const sceneRepo = getSceneRepo(projectId)
      const scenes = await new LoadSequenceUseCase(sceneRepo).execute(
        ProjetAudiovisuelId.from(projectId)
      )
      return ipcSuccess(await Promise.all(scenes.map((scene) => serializeScene(sceneRepo, scene))))
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_CREATE, async (_event, input: unknown) => {
    try {
      const parsed = SceneCreateInputSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid scene input')
      const sceneRepo = getSceneRepo(parsed.data.projetId)
      const scene = await new CreateSceneUseCase(sceneRepo).execute(parsed.data)
      return ipcSuccess(await serializeScene(sceneRepo, scene))
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_UPDATE, async (_event, input: unknown) => {
    try {
      const parsed = SceneUpdateInputSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid scene update')
      const sceneRepo = getSceneRepo(parsed.data.projetId)
      const scene = await new UpdateSceneUseCase(sceneRepo).execute(parsed.data)
      return ipcSuccess(await serializeScene(sceneRepo, scene))
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_DELETE, async (_event, input: unknown) => {
    try {
      const data = input as Record<string, unknown>
      if (!data || typeof data.sceneId !== 'string' || typeof data.projetId !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      await new DeleteSceneUseCase(getSceneRepo(data.projetId as string)).execute(data.sceneId as string)
      return ipcSuccess({ deleted: true })
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_DUPLICATE, async (_event, input: unknown) => {
    try {
      const data = input as Record<string, unknown>
      if (!data || typeof data.sceneId !== 'string' || typeof data.projetId !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      const sceneRepo = getSceneRepo(data.projetId as string)
      const scene = await new DuplicateSceneUseCase(sceneRepo).execute(data.sceneId as string)
      return ipcSuccess(await serializeScene(sceneRepo, scene))
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_REORDER, async (_event, input: unknown) => {
    try {
      const data = input as Record<string, unknown>
      if (!data || typeof data.projetId !== 'string' || !Array.isArray(data.orderedIds))
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      await new ReorderScenesUseCase(getSceneRepo(data.projetId as string)).execute(
        data.projetId as string,
        data.orderedIds as string[]
      )
      return ipcSuccess({ reordered: true })
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  // Phase 4: Media handlers
  const mediaRepos = new Map<string, ReturnType<typeof createDrizzleMediaRepository>>()

  function getMediaRepo(projectId: string): ReturnType<typeof createDrizzleMediaRepository> {
    let mr = mediaRepos.get(projectId)
    if (!mr) {
      const dbPath = getProjectManifestService().getDatabasePath(projectId)
      mr = createDrizzleMediaRepository(dbPath)
      mediaRepos.set(projectId, mr)
    }
    return mr
  }

  const mediaWatcher = new MediaWatcher(async (projectId, cheminRelatif) => {
    try {
      const mediaRepo = getMediaRepo(projectId)
      const medias = await mediaRepo.findAll(ProjetAudiovisuelId.from(projectId))
      const media = medias.find((candidate) => candidate.cheminRelatif === cheminRelatif)
      if (!media || media.isManquante) return
      const updated = media.marquerManquante()
      await mediaRepo.save(updated)
      logger.warn({ projectId, mediaId: updated.id.value, cheminRelatif }, 'Media marked as missing by watcher')
    } catch (error) {
      logger.warn({ err: error, projectId, cheminRelatif }, 'Failed to mark watched media as missing')
    }
  })


  ipcMain.handle(IPC_CHANNELS.MEDIA_IMPORT, async (_event, input: unknown) => {
    try {
      const data = input as { sourcePath: string; projetId: string }
      if (!data || typeof data.sourcePath !== 'string' || typeof data.projetId !== 'string') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      }
      const result = await executeMediaImport(data.sourcePath, data.projetId)
      const repo = getMediaRepo(data.projetId)
      const media = await new ImportMediaUseCase(repo).execute({
        projetId: data.projetId,
        mimeType: result.mimeType,
        type: result.type as never,
        checksum: result.checksum,
        cheminRelatif: result.cheminRelatif,
        nomOriginal: result.nomOriginal,
        tailleOctets: result.tailleOctets,
        largeur: result.largeur,
        hauteur: result.hauteur
      })
      return ipcSuccess({
        ...result,
        id: media.id.value,
        type: media.type,
        cheminRelatif: media.cheminRelatif,
        nomOriginal: media.nomOriginal,
        checksum: media.checksum,
        tailleOctets: media.tailleOctets,
        mimeType: media.mimeType,
        largeur: media.largeur,
        hauteur: media.hauteur,
        dureeMs: media.dureeMs,
        statut: media.statut,
        previewUrl: media.isDisponible ? toMediaPreviewUrl(data.projetId, media.id.value) : null
      })
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Import failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_LIST, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string') return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      const medias = await getMediaRepo(projectId).findAll(ProjetAudiovisuelId.from(projectId))
      return ipcSuccess(medias.map(m => ({
        id: m.id.value,
        type: m.type,
        cheminRelatif: m.cheminRelatif,
        nomOriginal: m.nomOriginal,
        checksum: m.checksum,
        tailleOctets: m.tailleOctets,
        mimeType: m.mimeType,
        largeur: m.largeur,
        hauteur: m.hauteur,
        dureeMs: m.dureeMs,
        statut: m.statut,
        previewUrl: m.isDisponible ? toMediaPreviewUrl(projectId, m.id.value) : null
      })))
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_ASSOCIATE, async (_event, input: unknown) => {
    try {
      const data = input as { sceneId: string; mediaId: string; projetId: string }
      if (!data || typeof data.sceneId !== 'string' || typeof data.mediaId !== 'string' || typeof data.projetId !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      await getSceneRepo(data.projetId).associateMedia(SceneId.from(data.sceneId), data.mediaId)
      return ipcSuccess({ associated: true })
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Association failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_MARK_MISSING, async (_event, input: unknown) => {
    try {
      const data = input as { mediaId: string; projetId: string }
      if (!data || typeof data.mediaId !== 'string' || typeof data.projetId !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      const repo = getMediaRepo(data.projetId)
      const media = await repo.findById(RessourceMediaId.from(data.mediaId))
      if (!media) return ipcFailure(ErrorCodes.IPC_ERROR, 'Media not found')
      const updated = media.marquerManquante()
      await repo.save(updated)
      return ipcSuccess({ id: updated.id.value, statut: updated.statut })
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_REPLACE, async (_event, input: unknown) => {
    try {
      const data = input as { mediaId: string; projetId: string; sourcePath: string }
      if (!data || typeof data.mediaId !== 'string' || typeof data.projetId !== 'string' || typeof data.sourcePath !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')

      const repo = getMediaRepo(data.projetId)
      const oldMedia = await repo.findById(RessourceMediaId.from(data.mediaId))
      if (!oldMedia) return ipcFailure(ErrorCodes.IPC_ERROR, 'Media not found')

      // Import the replacement file
      const result = await executeMediaImport(data.sourcePath, data.projetId)

      // Restore status and update metadata from the new import
      const restored = oldMedia.restaurer()
      const updatedMedia = RessourceMedia.fromPersistence({
        id: restored.id,
        projetId: restored.projetId,
        type: result.type as never,
        cheminRelatif: result.cheminRelatif,
        nomOriginal: result.nomOriginal,
        checksum: result.checksum,
        tailleOctets: result.tailleOctets,
        mimeType: result.mimeType,
        largeur: result.largeur,
        hauteur: result.hauteur,
        dureeMs: result.dureeMs ?? null,
        statut: restored.statut,
        droits: restored.droits,
        version: restored.version,
        sourceMediaId: oldMedia.sourceMediaId
      })

      await repo.save(updatedMedia)
      return ipcSuccess({ id: updatedMedia.id.value, cheminRelatif: updatedMedia.cheminRelatif, statut: updatedMedia.statut, thumbnailPath: result.thumbnailPath })
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Replace failed')
    }
  })

  // Phase 7 subtitle master remains the authored timing source. Phase 8 binds
  // its placeholder DeclinaisonId to the first materialized 16:9 declination.
  const subtitleRepos = new Map<string, ReturnType<typeof createDrizzleSubtitleRepository>>()

  function getSubtitleRepo(projectId: string): ReturnType<typeof createDrizzleSubtitleRepository> {
    let subtitleRepo = subtitleRepos.get(projectId)
    if (!subtitleRepo) {
      subtitleRepo = createDrizzleSubtitleRepository(getProjectManifestService().getDatabasePath(projectId))
      subtitleRepos.set(projectId, subtitleRepo)
    }
    return subtitleRepo
  }

  async function markSubtitlesResync(projectId: string): Promise<void> {
    await new MarkSubtitlesResyncUseCase(getSubtitleRepo(projectId)).execute()
  }

  // Phase 6: Local narration handlers
  const narrationRepos = new Map<string, ReturnType<typeof createDrizzleNarrationRepository>>()
  const narrationControllers = new Map<string, AbortController>()

  function getNarrationRepo(projectId: string): ReturnType<typeof createDrizzleNarrationRepository> {
    let narrationRepo = narrationRepos.get(projectId)
    if (!narrationRepo) {
      narrationRepo = createDrizzleNarrationRepository(getProjectManifestService().getDatabasePath(projectId))
      narrationRepos.set(projectId, narrationRepo)
    }
    return narrationRepo
  }

  function getNarrationFilesystem(projectId: string): NarrationFilesystem {
    return new NarrationFilesystem(getProjectManifestService().getProjectDir(projectId))
  }

  function getPiperAdapter(projectId: string): PiperGenerationAdapter {
    const appRoot = app.isPackaged ? process.resourcesPath : app.getAppPath()
    const projectDir = getProjectManifestService().getProjectDir(projectId)
    return new PiperGenerationAdapter(
      projectDir,
      defaultPiperExecutable(appRoot),
      [defaultFrenchVoice(appRoot)]
    )
  }

  function serializeNarration(track: PisteNarration) {
    return {
      id: track.id.value,
      projetId: track.projetId.value,
      langue: track.langue,
      prises: track.segments,
      priseFinaleId: track.priseFinaleId,
      statut: track.statut,
      versionTexte: track.versionTexte.value
    }
  }

  const NarrationGetSchema = z.object({
    projectId: z.string().min(1),
    langue: z.string().min(1).max(10)
  })
  const NarrationGenerateSchema = z.object({
    projectId: z.string().min(1),
    langue: z.string().min(1).max(10),
    texte: z.string().min(1).max(100000),
    voixId: z.literal('fr_FR-siwis-medium'),
    sceneId: z.string().min(1).nullable().optional()
  })
  const NarrationImportSchema = z.object({
    projectId: z.string().min(1),
    langue: z.string().min(1).max(10),
    texte: z.string().max(100000).optional(),
    sceneId: z.string().min(1).nullable().optional()
  })
  const NarrationTakeSchema = z.object({
    projectId: z.string().min(1),
    takeId: z.string().min(1)
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_GET, async (_event, input: unknown) => {
    try {
      const parsed = NarrationGetSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Paramètres de narration invalides')
      await getNarrationFilesystem(parsed.data.projectId).ensureDirectories()
      const track = await new GetNarrationTrackUseCase(getNarrationRepo(parsed.data.projectId)).execute(
        parsed.data.projectId,
        parsed.data.langue
      )
      return ipcSuccess(serializeNarration(track))
    } catch (error) {
      logger.error({ err: error }, 'narration:get failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Narration indisponible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_GENERATE, async (_event, input: unknown) => {
    const parsed = NarrationGenerateSchema.safeParse(input)
    if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Texte ou voix invalide')
    const { projectId, langue, texte, voixId, sceneId } = parsed.data
    if (narrationControllers.has(projectId)) {
      return ipcFailure(ErrorCodes.IPC_ERROR, 'Une génération de narration est déjà en cours')
    }

    const controller = new AbortController()
    narrationControllers.set(projectId, controller)
    try {
      const narrationRepo = getNarrationRepo(projectId)
      const track = await new GetNarrationTrackUseCase(narrationRepo).execute(projectId, langue)
      const updated = await new GenerateNarrationUseCase(narrationRepo, getPiperAdapter(projectId)).execute({
        track,
        texte,
        voixId,
        sceneId,
        signal: controller.signal
      })
      if (!updated.versionTexte.equals(track.versionTexte)) await markSubtitlesResync(projectId)
      return ipcSuccess(serializeNarration(updated))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de génération de narration'
      const controlled: Record<string, string> = {
        EMPTY_TEXT: 'Le texte de narration est vide.',
        PIPER_NOT_FOUND: 'Le moteur vocal Piper est absent.',
        VOICE_MODEL_ERROR: 'Le modèle vocal français est absent ou invalide.',
        PIPER_TIMEOUT: 'La génération vocale a dépassé le délai autorisé.',
        NARRATION_CANCELLED: 'La génération vocale a été annulée.'
      }
      logger.warn({ err: error, projectId }, 'narration:generate failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, controlled[message] ?? 'La génération de narration a échoué.')
    } finally {
      if (narrationControllers.get(projectId) === controller) narrationControllers.delete(projectId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_IMPORT, async (_event, input: unknown) => {
    try {
      const parsed = NarrationImportSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Paramètres d’import audio invalides')
      const selection = await dialog.showOpenDialog({
        title: 'Importer une narration',
        properties: ['openFile'],
        filters: [{ name: 'Audio narration', extensions: ['wav', 'mp3'] }]
      })
      if (selection.canceled || selection.filePaths.length === 0) {
        const track = await new GetNarrationTrackUseCase(getNarrationRepo(parsed.data.projectId)).execute(
          parsed.data.projectId,
          parsed.data.langue
        )
        return ipcSuccess({ ...serializeNarration(track), canceled: true })
      }
      const narrationRepo = getNarrationRepo(parsed.data.projectId)
      const track = await new GetNarrationTrackUseCase(narrationRepo).execute(parsed.data.projectId, parsed.data.langue)
      const updated = await new ImportNarrationUseCase(narrationRepo, getNarrationFilesystem(parsed.data.projectId)).execute({
        track,
        sourcePath: selection.filePaths[0],
        texte: parsed.data.texte,
        sceneId: parsed.data.sceneId
      })
      if (!updated.versionTexte.equals(track.versionTexte)) await markSubtitlesResync(parsed.data.projectId)
      return ipcSuccess(serializeNarration(updated))
    } catch (error) {
      logger.warn({ err: error }, 'narration:import failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Import narration impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_SELECT_FINAL, async (_event, input: unknown) => {
    try {
      const parsed = NarrationTakeSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Prise de narration invalide')
      const narrationRepo = getNarrationRepo(parsed.data.projectId)
      const before = await narrationRepo.findByProject(ProjetAudiovisuelId.from(parsed.data.projectId))
      const updated = await new SelectFinalNarrationTakeUseCase(narrationRepo).execute(
        parsed.data.projectId,
        parsed.data.takeId
      )
      if (before?.priseFinaleId !== updated.priseFinaleId) await markSubtitlesResync(parsed.data.projectId)
      return ipcSuccess(serializeNarration(updated))
    } catch (error) {
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Sélection impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_READ_AUDIO, async (_event, input: unknown) => {
    try {
      const parsed = NarrationTakeSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Prise de narration invalide')
      const result = await new ReadNarrationAudioUseCase(
        getNarrationRepo(parsed.data.projectId),
        getNarrationFilesystem(parsed.data.projectId)
      ).execute(parsed.data.projectId, parsed.data.takeId)
      return ipcSuccess(result)
    } catch (error) {
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Audio narration indisponible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NARRATION_CANCEL, (_event, projectId: unknown) => {
    if (typeof projectId !== 'string' || !projectId) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Projet invalide')
    }
    const controller = narrationControllers.get(projectId)
    if (!controller) return ipcSuccess({ canceled: false })
    controller.abort()
    return ipcSuccess({ canceled: true })
  })

  // Phase 7: subtitle authoring, synchronization and export.
  function serializeSubtitles(track: PisteSousTitres) {
    return {
      id: track.id.value,
      declinaisonId: track.declinaisonId.value,
      langue: track.langue,
      segments: track.segments,
      statut: track.statut,
      versionNarration: track.versionNarration.value
    }
  }

  const SubtitleProjectSchema = z.object({
    projectId: z.string().min(1),
    langue: z.string().min(1).max(10)
  })
  const SubtitleStyleSchema = z.object({
    fontSize: z.number().min(36).max(44).optional(),
    color: z.string().min(1).max(64).optional(),
    backgroundColor: z.string().min(1).max(64).optional(),
    fontWeight: z.enum(['normal', 'bold']).optional()
  })
  const SubtitleUpdateSchema = z.object({
    projectId: z.string().min(1),
    segmentId: z.string().min(1),
    debutMs: z.number().int().min(0).optional(),
    finMs: z.number().int().positive().optional(),
    texte: z.string().min(1).max(85).optional(),
    position: z.enum(['haut', 'centre', 'bas']).optional(),
    style: SubtitleStyleSchema.optional()
  })
  const SubtitleAddSchema = z.object({
    projectId: z.string().min(1),
    debutMs: z.number().int().min(0),
    finMs: z.number().int().positive(),
    texte: z.string().min(1).max(85),
    position: z.enum(['haut', 'centre', 'bas']),
    style: SubtitleStyleSchema.optional()
  })
  const SubtitleDeleteSchema = z.object({
    projectId: z.string().min(1),
    segmentId: z.string().min(1)
  })
  const SubtitleExportSchema = z.object({
    projectId: z.string().min(1),
    format: z.enum(['srt', 'vtt'])
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_GET, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleProjectSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Paramètres de sous-titres invalides')
      const narration = await getNarrationRepo(parsed.data.projectId).findByProject(
        ProjetAudiovisuelId.from(parsed.data.projectId)
      )
      const track = await new GetSubtitleTrackUseCase(getSubtitleRepo(parsed.data.projectId)).execute(
        parsed.data.langue,
        narration?.versionTexte.value ?? 1
      )
      return ipcSuccess(serializeSubtitles(track))
    } catch (error) {
      logger.error({ err: error }, 'subtitles:get failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Sous-titres indisponibles')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_SYNCHRONIZE, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleProjectSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Paramètres de synchronisation invalides')
      const updated = await new SynchronizeSubtitlesUseCase(
        getSubtitleRepo(parsed.data.projectId),
        getNarrationRepo(parsed.data.projectId)
      ).execute(parsed.data.projectId, parsed.data.langue)
      return ipcSuccess(serializeSubtitles(updated))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Synchronisation impossible'
      const controlled: Record<string, string> = {
        FINAL_NARRATION_REQUIRED: 'Sélectionnez d’abord une prise de narration finale.',
        SUBTITLE_SOURCE_TEXT_EMPTY: 'La prise finale ne contient aucun texte pour créer les sous-titres.'
      }
      return ipcFailure(ErrorCodes.IPC_ERROR, controlled[message] ?? message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_UPDATE_SEGMENT, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleUpdateSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Segment de sous-titre invalide')
      const { projectId, segmentId, ...patch } = parsed.data
      const updated = await new UpdateSubtitleSegmentUseCase(getSubtitleRepo(projectId)).execute(segmentId, patch)
      return ipcSuccess(serializeSubtitles(updated))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Modification impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_ADD_SEGMENT, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleAddSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Nouveau segment invalide')
      const { projectId, ...segment } = parsed.data
      const updated = await new AddSubtitleSegmentUseCase(getSubtitleRepo(projectId)).execute(segment)
      return ipcSuccess(serializeSubtitles(updated))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Ajout impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_DELETE_SEGMENT, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleDeleteSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Segment invalide')
      const updated = await new DeleteSubtitleSegmentUseCase(getSubtitleRepo(parsed.data.projectId)).execute(
        parsed.data.segmentId
      )
      return ipcSuccess(serializeSubtitles(updated))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Suppression impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_VALIDATE, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string' || !projectId) {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Projet invalide')
      }
      const updated = await new ValidateSubtitleTrackUseCase(
        getSubtitleRepo(projectId),
        getNarrationRepo(projectId)
      ).execute(projectId)
      return ipcSuccess(serializeSubtitles(updated))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation impossible'
      if (message === 'FINAL_NARRATION_REQUIRED') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Sélectionnez d’abord une prise de narration finale.')
      }
      if (message === 'SUBTITLE_RESYNC_REQUIRED') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Resynchronisez les sous-titres avec la narration avant validation.')
      }
      if (message === 'SUBTITLE_OUTSIDE_NARRATION') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Un sous-titre dépasse la durée de la narration finale.')
      }
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_EXPORT, async (_event, input: unknown) => {
    try {
      const parsed = SubtitleExportSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Format d’export invalide')
      const extension = parsed.data.format
      const manifest = getProjectManifestService().readManifest(parsed.data.projectId)
      const safeTitle = (manifest?.titre ?? 'SCPT')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim()
        .slice(0, 80) || 'SCPT'
      const selection = await dialog.showSaveDialog({
        title: `Exporter les sous-titres ${extension.toUpperCase()}`,
        defaultPath: `${safeTitle}.${extension}`,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      })
      if (selection.canceled || !selection.filePath) {
        return ipcSuccess({ canceled: true, format: extension })
      }
      const result = await new ExportSubtitlesUseCase(
        getSubtitleRepo(parsed.data.projectId),
        new SubtitleFilesystem(getProjectManifestService().getProjectDir(parsed.data.projectId))
      ).execute({ format: extension, destinationPath: selection.filePath })
      return ipcSuccess({ canceled: false, format: extension, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export impossible'
      if (message === 'SUBTITLE_TRACK_NOT_VALIDATED') {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Validez les sous-titres avant de les exporter.')
      }
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })


  // Phase 8: visual declinations, source-version obsolescence and per-format preview.
  const declinaisonRepos = new Map<string, ReturnType<typeof createDrizzleDeclinaisonRepository>>()
  const sourceVersionAdapters = new Map<string, ReturnType<typeof createProjectSourceVersionAdapter>>()

  function getDeclinaisonRepo(projectId: string): ReturnType<typeof createDrizzleDeclinaisonRepository> {
    let value = declinaisonRepos.get(projectId)
    if (!value) {
      value = createDrizzleDeclinaisonRepository(getProjectManifestService().getDatabasePath(projectId))
      declinaisonRepos.set(projectId, value)
    }
    return value
  }

  function getSourceVersion(projectId: string): ReturnType<typeof createProjectSourceVersionAdapter> {
    let value = sourceVersionAdapters.get(projectId)
    if (!value) {
      value = createProjectSourceVersionAdapter(getProjectManifestService().getDatabasePath(projectId))
      sourceVersionAdapters.set(projectId, value)
    }
    return value
  }

  function safeZoneForFormat(format: string) {
    if (format === 'HORIZONTAL_16_9') return { left: 64, right: 64, top: 48, bottom: 48 }
    if (format === 'VERTICAL_9_16') return { left: 64, right: 64, top: 128, bottom: 128 }
    return { left: 64, right: 64, top: 64, bottom: 64 }
  }

  function serializeDeclinaison(
    declinaison: DeclinaisonAudiovisuelle,
    versionSourceCourante: number
  ) {
    return {
      id: declinaison.id.value,
      projectId: declinaison.projetId.value,
      format: declinaison.format.value,
      resolution: declinaison.resolution.value,
      langue: declinaison.langue,
      profilExport: declinaison.profilExport.value,
      statut: declinaison.statut,
      versionProjetSource: declinaison.versionProjetSource.value,
      versionSourceCourante,
      version: declinaison.version.value,
      obsolete: declinaison.isObsolete,
      pretPourRendu: declinaison.isReadyForRender,
      safeZone: safeZoneForFormat(declinaison.format.value),
      overrides: declinaison.overrides
    }
  }

  const DeclinaisonCreateSchema = z.object({
    projectId: z.string().min(1),
    format: z.enum(['HORIZONTAL_16_9', 'VERTICAL_9_16', 'CARRE_1_1']),
    langue: z.string().min(1).max(10),
    profilExport: z.literal('MVP_PREMIUM').optional()
  })
  const DeclinaisonOverrideSchema = z.object({
    projectId: z.string().min(1),
    declinaisonId: z.string().min(1),
    sceneId: z.string().min(1),
    layout: z.enum(['centered', 'top', 'split-left', 'split-right']).optional(),
    backgroundColor: z.string().min(1).max(64).optional()
  }).refine((value) => value.layout !== undefined || value.backgroundColor !== undefined, {
    message: 'At least one override property is required'
  })
  const DeclinaisonRemoveOverrideSchema = z.object({
    projectId: z.string().min(1),
    declinaisonId: z.string().min(1),
    sceneId: z.string().min(1)
  })
  const DeclinaisonActionSchema = z.object({
    projectId: z.string().min(1),
    declinaisonId: z.string().min(1)
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_LIST, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string' || !projectId) {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Projet invalide')
      }
      const rows = await new ListDeclinaisonsUseCase(
        getDeclinaisonRepo(projectId),
        getSourceVersion(projectId)
      ).execute(projectId)
      return ipcSuccess(rows.map((row) => serializeDeclinaison(row.declinaison, row.currentSourceVersion)))
    } catch (error) {
      logger.error({ err: error, projectId }, 'declinaisons:list failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Déclinaisons indisponibles')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_CREATE, async (_event, input: unknown) => {
    try {
      const parsed = DeclinaisonCreateSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Paramètres de déclinaison invalides')
      let preferredId: string | undefined
      if (parsed.data.format === 'HORIZONTAL_16_9') {
        const subtitleRepo = getSubtitleRepo(parsed.data.projectId)
        let masterSubtitle = await subtitleRepo.findMaster()
        if (!masterSubtitle) {
          const narration = await getNarrationRepo(parsed.data.projectId).findByProject(
            ProjetAudiovisuelId.from(parsed.data.projectId)
          )
          masterSubtitle = await new GetSubtitleTrackUseCase(subtitleRepo).execute(
            parsed.data.langue,
            narration?.versionTexte.value ?? 1
          )
        }
        preferredId = masterSubtitle.declinaisonId.value
      }
      const created = await new CreateDeclinaisonUseCase(
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute({ ...parsed.data, preferredId })
      const current = await getSourceVersion(parsed.data.projectId).current(ProjetAudiovisuelId.from(parsed.data.projectId))
      return ipcSuccess(serializeDeclinaison(created, current.value))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Création impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_SET_OVERRIDE, async (_event, input: unknown) => {
    try {
      const parsed = DeclinaisonOverrideSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Surcharge de scène invalide')
      const updated = await new SetDeclinaisonOverrideUseCase(
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data)
      const current = await getSourceVersion(parsed.data.projectId).current(ProjetAudiovisuelId.from(parsed.data.projectId))
      return ipcSuccess(serializeDeclinaison(updated, current.value))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Surcharge impossible'
      return ipcFailure(message === 'DECLINATION_SOURCE_OBSOLETE' ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.IPC_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_REMOVE_OVERRIDE, async (_event, input: unknown) => {
    try {
      const parsed = DeclinaisonRemoveOverrideSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Surcharge invalide')
      const updated = await new RemoveDeclinaisonOverrideUseCase(
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data.projectId, parsed.data.declinaisonId, parsed.data.sceneId)
      const current = await getSourceVersion(parsed.data.projectId).current(ProjetAudiovisuelId.from(parsed.data.projectId))
      return ipcSuccess(serializeDeclinaison(updated, current.value))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Suppression de surcharge impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_VALIDATE, async (_event, input: unknown) => {
    try {
      const parsed = DeclinaisonActionSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Déclinaison invalide')
      const updated = await new ValidateDeclinaisonUseCase(
        getDeclinaisonRepo(parsed.data.projectId),
        getSceneRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data)
      const current = await getSourceVersion(parsed.data.projectId).current(ProjetAudiovisuelId.from(parsed.data.projectId))
      return ipcSuccess(serializeDeclinaison(updated, current.value))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation impossible'
      const controlled = message === 'DECLINATION_SOURCE_OBSOLETE'
        ? 'La source du projet a changé. Créez une nouvelle déclinaison avant validation.'
        : message
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, controlled)
    }
  })

  ipcMain.handle(IPC_CHANNELS.DECLINAISONS_MARK_READY, async (_event, input: unknown) => {
    try {
      const parsed = DeclinaisonActionSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Déclinaison invalide')
      const updated = await new MarkDeclinaisonReadyUseCase(
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data)
      const current = await getSourceVersion(parsed.data.projectId).current(ProjetAudiovisuelId.from(parsed.data.projectId))
      return ipcSuccess(serializeDeclinaison(updated, current.value))
    } catch (error) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, error instanceof Error ? error.message : 'Préparation impossible')
    }
  })


  // Phase 9: local Remotion rendering jobs. One queue is shared across projects,
  // preserving the canonical single-render concurrency limit.
  const renderRepos = new Map<string, ReturnType<typeof createDrizzleExportRepository>>()
  const renderEngine = new RemotionRenderAdapter()
  let renderCoordinator: RenderJobCoordinator | null = null
  const renderRecoveryPerformed = new Set<string>()

  function getRenderRepo(projectId: string): ReturnType<typeof createDrizzleExportRepository> {
    let value = renderRepos.get(projectId)
    if (!value) {
      value = createDrizzleExportRepository(getProjectManifestService().getDatabasePath(projectId))
      renderRepos.set(projectId, value)
    }
    return value
  }

  function getRenderCoordinator(): RenderJobCoordinator {
    renderCoordinator ??= new RenderJobCoordinator({
      engine: renderEngine,
      contextFor(projectId) {
        return {
          exports: getRenderRepo(projectId),
          declinaisons: getDeclinaisonRepo(projectId),
          sourceVersions: getSourceVersion(projectId),
          payloadBuilder: new ProjectRenderPayloadBuilder(
            getProjectManifestService().getProjectDir(projectId),
            getSceneRepo(projectId),
            getMediaRepo(projectId),
            getNarrationRepo(projectId),
            getSubtitleRepo(projectId)
          ),
          projectDir: getProjectManifestService().getProjectDir(projectId)
        }
      },
      entryPointFor: () => resolveRemotionEntryPoint(app.getAppPath()),
      browserExecutableFor: () => resolveRenderBrowser(app.getAppPath())
    })
    return renderCoordinator
  }

  async function ensureRenderRecovery(projectId: string): Promise<void> {
    if (renderRecoveryPerformed.has(projectId)) return
    await getRenderCoordinator().recoverProject(projectId)
    renderRecoveryPerformed.add(projectId)
  }

  function serializeRenderJob(job: ExportAudiovisuel) {
    return {
      id: job.id.value,
      projectId: job.projetId.value,
      declinaisonId: job.declinaisonId.value,
      tentative: job.tentative,
      statut: job.statut,
      progression: job.progression,
      cheminFichier: job.cheminFichier,
      checksum: job.checksum,
      diagnostic: job.diagnostic,
      profil: job.profil.value,
      versionProjetSource: job.versionsSources.versionProjetSource.value,
      versionDeclinaisonSource: job.versionsSources.versionDeclinaison.value,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      actif: job.isActive,
      peutRelancer: job.canRetry,
      logRelativePath: `logs/render-${job.id.value.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`
    }
  }

  const RenderActionSchema = z.object({
    projectId: z.string().min(1),
    jobId: z.string().min(1)
  })
  const RenderStartSchema = z.object({
    projectId: z.string().min(1),
    declinaisonId: z.string().min(1)
  })

  ipcMain.handle(IPC_CHANNELS.RENDER_LIST, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string' || !projectId) {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Projet invalide')
      }
      await ensureRenderRecovery(projectId)
      const jobs = await new ListRenderJobsUseCase(getRenderRepo(projectId)).execute(projectId)
      return ipcSuccess(jobs.map(serializeRenderJob))
    } catch (error) {
      logger.error({ err: error, projectId }, 'render:list failed')
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Rendus indisponibles')
    }
  })

  ipcMain.handle(IPC_CHANNELS.RENDER_START, async (_event, input: unknown) => {
    try {
      const parsed = RenderStartSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Demande de rendu invalide')
      await ensureRenderRecovery(parsed.data.projectId)
      const job = await new RequestRenderUseCase(
        getRenderRepo(parsed.data.projectId),
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data)
      getRenderCoordinator().schedule(parsed.data.projectId, job.id.value)
      return ipcSuccess(serializeRenderJob(job))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rendu impossible'
      const controlled: Record<string, string> = {
        RENDER_DECLINATION_NOT_FOUND: 'Déclinaison introuvable.',
        RENDER_DECLINATION_OBSOLETE: 'Cette déclinaison est obsolète.',
        RENDER_DECLINATION_NOT_READY: 'Validez puis marquez la déclinaison prête pour le rendu.',
        RENDER_SOURCE_OBSOLETE: 'Le projet a changé depuis la validation de la déclinaison.',
        RENDER_ALREADY_ACTIVE: 'Un rendu de cette déclinaison est déjà en cours.'
      }
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, controlled[message] ?? message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RENDER_CANCEL, async (_event, input: unknown) => {
    try {
      const parsed = RenderActionSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Tâche de rendu invalide')
      const canceled = await getRenderCoordinator().cancel(parsed.data.projectId, parsed.data.jobId)
      return ipcSuccess({ canceled })
    } catch (error) {
      return ipcFailure(ErrorCodes.IPC_ERROR, error instanceof Error ? error.message : 'Annulation impossible')
    }
  })

  ipcMain.handle(IPC_CHANNELS.RENDER_RETRY, async (_event, input: unknown) => {
    try {
      const parsed = RenderActionSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Tâche de rendu invalide')
      await ensureRenderRecovery(parsed.data.projectId)
      const job = await new RetryRenderUseCase(
        getRenderRepo(parsed.data.projectId),
        getDeclinaisonRepo(parsed.data.projectId),
        getSourceVersion(parsed.data.projectId)
      ).execute(parsed.data.jobId)
      getRenderCoordinator().schedule(parsed.data.projectId, job.id.value)
      return ipcSuccess(serializeRenderJob(job))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Relance impossible'
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RENDER_READ_LOG, async (_event, input: unknown) => {
    try {
      const parsed = RenderActionSchema.safeParse(input)
      if (!parsed.success) return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Tâche de rendu invalide')
      const job = await getRenderRepo(parsed.data.projectId).findById(ExportId.from(parsed.data.jobId))
      if (!job || job.projetId.value !== parsed.data.projectId) {
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Tâche de rendu introuvable')
      }
      const content = await new RenderFilesystem(
        getProjectManifestService().getProjectDir(parsed.data.projectId)
      ).readLog(`logs/render-${job.id.value.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`)
      return ipcSuccess({ content })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Diagnostic indisponible'
      return ipcFailure(ErrorCodes.IPC_ERROR, message)
    }
  })

  let phase9QuitInProgress = false
  app.on('before-quit', (event) => {
    if (phase9QuitInProgress) return
    event.preventDefault()
    phase9QuitInProgress = true
    void (async () => {
      try {
        await renderCoordinator?.shutdown()
        await renderEngine.dispose()
        mediaWatcher.stopAll()
        await getLockManager().releaseAll()
        for (const renderRepo of renderRepos.values()) renderRepo.close()
        for (const sceneRepo of sceneRepos.values()) sceneRepo.close()
        for (const mediaRepo of mediaRepos.values()) mediaRepo.close()
        for (const narrationRepo of narrationRepos.values()) narrationRepo.close()
        for (const subtitleRepo of subtitleRepos.values()) subtitleRepo.close()
        for (const declinaisonRepo of declinaisonRepos.values()) declinaisonRepo.close()
        for (const sourceVersion of sourceVersionAdapters.values()) sourceVersion.close()
        renderRepos.clear()
        sceneRepos.clear()
        mediaRepos.clear()
        narrationRepos.clear()
        subtitleRepos.clear()
        declinaisonRepos.clear()
        sourceVersionAdapters.clear()
      } catch (error) {
        logger.warn({ err: error }, 'Graceful Phase 9 shutdown encountered an error')
      } finally {
        app.quit()
      }
    })()
  })

  logger.info('IPC handlers registered (Phase 1 through Phase 9 Remotion rendering)')
}