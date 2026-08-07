import { contextBridge } from 'electron'

const scptApi = {
  ping: (): string => 'pong'
}

contextBridge.exposeInMainWorld('scpt', {
  system: scptApi
})