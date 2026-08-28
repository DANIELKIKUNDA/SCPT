import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import type { ElectronAPI } from '../shared/types/electron-api'

const electronAPI: ElectronAPI = {
  systemPing: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
  systemGetAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_INFO),
  preferencesGet: (key) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET, key),
  preferencesSet: (data) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, data),
  projectsCreate: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, input),
  projectsOpen: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_OPEN, projectId),
  projectsClose: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CLOSE, projectId),
  projectsListRecent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST_RECENT),
  projectsArchive: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_ARCHIVE, projectId),
  projectsRestore: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_RESTORE, projectId),
  scenesLoadSequence: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_LOAD_SEQUENCE, projectId),
  scenesCreate: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_CREATE, input),
  scenesUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_UPDATE, input),
  scenesDelete: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_DELETE, input),
  scenesDuplicate: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_DUPLICATE, input),
  scenesReorder: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCENES_REORDER, input),
  mediaImport: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_IMPORT, input),
  mediaList: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_LIST, projectId),
  mediaAssociate: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_ASSOCIATE, input),
  mediaMarkMissing: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_MARK_MISSING, input),
  mediaReplace: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_REPLACE, input),
  narrationGet: (input) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_GET, input),
  narrationGenerate: (input) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_GENERATE, input),
  narrationImport: (input) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_IMPORT, input),
  narrationSelectFinal: (input) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_SELECT_FINAL, input),
  narrationReadAudio: (input) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_READ_AUDIO, input),
  narrationCancel: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.NARRATION_CANCEL, projectId)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
