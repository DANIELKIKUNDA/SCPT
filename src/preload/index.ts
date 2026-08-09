import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'

const electronAPI = {
  systemPing: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
  systemGetAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_INFO),
  preferencesGet: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET, key),
  preferencesSet: (data: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, data),
  projectsCreate: (input: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, input),
  projectsOpen: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_OPEN, projectId),
  projectsClose: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CLOSE, projectId),
  projectsListRecent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST_RECENT),
  projectsArchive: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_ARCHIVE, projectId),
  projectsRestore: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_RESTORE, projectId),
  scenesLoadSequence: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_LOAD_SEQUENCE, projectId),
  scenesCreate: () => ipcRenderer.invoke(IPC_CHANNELS.SCENES_CREATE, null),
  scenesUpdate: (input: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_UPDATE, input),
  scenesDelete: (input: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_DELETE, input),
  scenesDuplicate: (input: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_DUPLICATE, input),
  scenesReorder: (input: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_REORDER, input)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)