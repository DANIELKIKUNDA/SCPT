export const IPC_CHANNELS = {
  SYSTEM_PING: 'system:ping',
  SYSTEM_GET_APP_INFO: 'system:get-app-info',
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_LIST_RECENT: 'projects:list-recent',
  PROJECTS_ARCHIVE: 'projects:archive',
  PROJECTS_RESTORE: 'projects:restore',
  PROJECTS_CLOSE: 'projects:close',
  SCENES_LOAD_SEQUENCE: 'scenes:load-sequence',
  SCENES_CREATE: 'scenes:create',
  SCENES_UPDATE: 'scenes:update',
  SCENES_DELETE: 'scenes:delete',
  SCENES_DUPLICATE: 'scenes:duplicate',
  SCENES_REORDER: 'scenes:reorder'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]