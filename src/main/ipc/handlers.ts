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
  // Initialize repo lazily on first handler call to ensure app is ready
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

  logger.info('IPC handlers registered (Phase 1 + Phase 2 + Lock)')
}