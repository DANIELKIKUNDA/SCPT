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

  app.on('before-quit', () => mediaWatcher.stopAll())

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
      const updated = await new SelectFinalNarrationTakeUseCase(getNarrationRepo(parsed.data.projectId)).execute(
        parsed.data.projectId,
        parsed.data.takeId
      )
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

  app.on('before-quit', () => {
    for (const controller of narrationControllers.values()) controller.abort()
    for (const narrationRepo of narrationRepos.values()) narrationRepo.close()
    narrationControllers.clear()
    narrationRepos.clear()
  })

  logger.info('IPC handlers registered (Phase 1 through Phase 6 narration)')
}