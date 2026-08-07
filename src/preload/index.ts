import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import type { IpcResult } from '../shared/types/ipc'
import type {
  Preferences,
  PreferenceKey,
  PartialPreferences
} from '../shared/validation/preferences-schema'

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
  } as PreferencesApi
}

contextBridge.exposeInMainWorld('scpt', scptApi)