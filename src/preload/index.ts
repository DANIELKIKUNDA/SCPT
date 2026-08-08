import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import type { IpcResult } from '../shared/types/ipc'
import type {
  Preferences,
  PreferenceKey,
  PartialPreferences
} from '../shared/validation/preferences-schema'

// Project DTOs
interface CreateProjectDTO {
  id: string
  titre: string
  type: string
  statut: string
  createdAt: string
}

interface OpenProjectDTO {
  id: string
  titre: string
  type: string
  objectif: string
  publicCible: string
  langueSource: string
  statut: string
  version: number
  createdAt: string
  updatedAt: string
  isArchived: boolean
}

interface ListRecentDTO {
  id: string
  titre: string
  type: string
  statut: string
  updatedAt: string
  isArchived: boolean
}

interface ArchiveProjectDTO {
  id: string
  statut: string
  archivedAt: string | null
}

interface RestoreProjectDTO {
  id: string
  statut: string
}

export interface SystemApi {
  ping: () => Promise<string>
  getAppInfo: () => Promise<{
    name: string
    version: string
    electronVersion: string
    isDev: boolean
  }>
}

export interface PreferencesApi {
  get: <K extends PreferenceKey>(
    key: K
  ) => Promise<{ key: K; value: Preferences[K] }>
  set: (partial: PartialPreferences) => Promise<Preferences>
}

export interface ProjectsApi {
  create: (input: Record<string, unknown>) => Promise<CreateProjectDTO>
  open: (projectId: string) => Promise<OpenProjectDTO>
  listRecent: () => Promise<ListRecentDTO[]>
  archive: (projectId: string) => Promise<ArchiveProjectDTO>
  restore: (projectId: string) => Promise<RestoreProjectDTO>
}

const scptApi = {
  system: {
    ping: async (): Promise<string> => {
      const result = (await ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING)) as IpcResult<{
        message: string
      }>
      if (!result.ok) throw new Error(result.error.message)
      return result.data.message
    },
    getAppInfo: async () => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.SYSTEM_GET_APP_INFO
      )) as IpcResult<{
        name: string
        version: string
        electronVersion: string
        isDev: boolean
      }>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    }
  } as SystemApi,
  preferences: {
    get: async <K extends PreferenceKey>(key: K) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PREFERENCES_GET,
        key
      )) as IpcResult<{ key: K; value: Preferences[K] }>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    set: async (partial: PartialPreferences) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PREFERENCES_SET,
        partial
      )) as IpcResult<Preferences>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    }
  } as PreferencesApi,
  projects: {
    create: async (input: Record<string, unknown>) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PROJECTS_CREATE,
        input
      )) as IpcResult<CreateProjectDTO>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    open: async (projectId: string) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PROJECTS_OPEN,
        projectId
      )) as IpcResult<OpenProjectDTO>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    listRecent: async () => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PROJECTS_LIST_RECENT
      )) as IpcResult<ListRecentDTO[]>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    archive: async (projectId: string) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PROJECTS_ARCHIVE,
        projectId
      )) as IpcResult<ArchiveProjectDTO>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    restore: async (projectId: string) => {
      const result = (await ipcRenderer.invoke(
        IPC_CHANNELS.PROJECTS_RESTORE,
        projectId
      )) as IpcResult<RestoreProjectDTO>
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    }
  } as ProjectsApi
}

contextBridge.exposeInMainWorld('scpt', scptApi)