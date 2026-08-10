import { ipcMain, app } from 'electron'
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
import { LoadSequenceUseCase } from '../../contexts/projects/application/use-cases/scene/load-sequence.use-case'
import { CreateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/create-scene.use-case'
import { UpdateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/update-scene.use-case'
import { DeleteSceneUseCase } from '../../contexts/projects/application/use-cases/scene/delete-scene.use-case'
import { DuplicateSceneUseCase } from '../../contexts/projects/application/use-cases/scene/duplicate-scene.use-case'
import { ReorderScenesUseCase } from '../../contexts/projects/application/use-cases/scene/reorder-scenes.use-case'

// Phase 4 imports
import { createDrizzleMediaRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-media-repository'
import { ImportMediaUseCase } from '../../contexts/projects/application/use-cases/media/import-media.use-case'
import { executeMediaImport } from './media-import.handler'
import { RessourceMediaId } from '../../contexts/projects/domain/value-objects/ressource-media-id'

let repo: ReturnType<typeof createSqliteProjectRepository> | null = null

function getProjectRepo(): ReturnType<typeof createSqliteProjectRepository> {
  if (!repo) {
    const dbPath = join(app.getPath('userData'), 'scpt-catalog.sqlite')
    logger.info({ dbPath }, 'Opening SQLite catalog')
    repo = createSqliteProjectRepository(dbPath)
  }
  return repo
}

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

  ipcMain.handle(IPC_CHANNELS.SCENES_LOAD_SEQUENCE, async (_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string') return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid project ID')
      const scenes = await new LoadSequenceUseCase(getSceneRepo(projectId)).execute(
        ProjetAudiovisuelId.from(projectId)
      )
      return ipcSuccess(scenes.map(s => ({
        id: s.id.value,
        projetId: s.projetId.value,
        ordre: s.ordre,
        type: s.type,
        titre: s.titre,
        narrationTexte: s.narrationTexte,
        texteAffiche: s.texteAffiche,
        dureeMs: s.dureeMs
      })))
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_CREATE, async (_event, input: unknown) => {
    try {
      const data = input as Record<string, unknown>
      if (!data || typeof data.projetId !== 'string') return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      const scene = await new CreateSceneUseCase(getSceneRepo(data.projetId)).execute(data as never)
      return ipcSuccess({ id: scene.id.value, ordre: scene.ordre, type: scene.type, titre: scene.titre, dureeMs: scene.dureeMs })
    } catch (err) {
      return ipcFailure(ErrorCodes.VALIDATION_ERROR, err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCENES_UPDATE, async (_event, input: unknown) => {
    try {
      const data = input as Record<string, unknown>
      if (!data || typeof data.sceneId !== 'string' || typeof data.projetId !== 'string')
        return ipcFailure(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
      const scene = await new UpdateSceneUseCase(getSceneRepo(data.projetId as string)).execute(data as never)
      return ipcSuccess({ id: scene.id.value, titre: scene.titre, dureeMs: scene.dureeMs })
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
      const scene = await new DuplicateSceneUseCase(getSceneRepo(data.projetId as string)).execute(data.sceneId as string)
      return ipcSuccess({ id: scene.id.value, ordre: scene.ordre, type: scene.type })
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
      return ipcSuccess({ ...result, id: media.id.value })
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
        statut: m.statut
      })))
    } catch (err) {
      return ipcFailure(ErrorCodes.IPC_ERROR, err instanceof Error ? err.message : 'Failed')
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

  logger.info('IPC handlers registered (Phase 1 + Phase 2 + Phase 3 + Phase 4)')
}