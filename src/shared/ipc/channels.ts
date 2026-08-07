export const IPC_CHANNELS = {
  SYSTEM_PING: 'system:ping',
  SYSTEM_GET_APP_INFO: 'system:get-app-info',
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]