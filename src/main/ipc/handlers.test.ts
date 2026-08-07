import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron's ipcMain before importing the module
vi.mock('electron', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    app: {
      getName: () => 'scpt',
      getVersion: () => '0.0.0',
      isPackaged: false,
      getPath: () => '/mock/userData',
      whenReady: () => Promise.resolve(),
      on: vi.fn(),
      quit: vi.fn()
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      }),
      _getHandler: (channel: string) => handlers.get(channel),
      _clear: () => handlers.clear()
    },
    BrowserWindow: {
      getAllWindows: () => []
    },
    session: {
      defaultSession: {
        webRequest: {
          onHeadersReceived: vi.fn()
        }
      }
    }
  }
})

vi.mock('../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn()
  }
}))

vi.mock('../preferences/store', () => ({
  getAllPreferences: vi.fn(() => ({ theme: 'system', language: 'fr', reduceMotion: false })),
  setPreferences: vi.fn((data: Record<string, unknown>) => ({
    theme: data.theme ?? 'system',
    language: 'fr',
    reduceMotion: false
  }))
}))

import { registerIpcHandlers } from './handlers'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import type { IpcResult } from '../../shared/types/ipc'

const getHandler = (channel: string) => (ipcMain as unknown as { _getHandler: (c: string) => (...args: unknown[]) => unknown })._getHandler(channel)

describe('IPC Handlers', () => {
  beforeEach(() => {
    (ipcMain as unknown as { _clear: () => void })._clear()
    registerIpcHandlers()
  })

  describe('system:ping', () => {
    it('returns success with pong', async () => {
      const handler = getHandler(IPC_CHANNELS.SYSTEM_PING)
      expect(handler).toBeDefined()
      const result = (await handler!()) as IpcResult<{ message: string; timestamp: number }>
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.message).toBe('pong')
        expect(typeof result.data.timestamp).toBe('number')
      }
    })
  })

  describe('system:get-app-info', () => {
    it('returns app info', async () => {
      const handler = getHandler(IPC_CHANNELS.SYSTEM_GET_APP_INFO)
      expect(handler).toBeDefined()
      const result = (await handler!()) as IpcResult<{
        name: string
        version: string
        electronVersion: string
        isDev: boolean
      }>
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.name).toBe('scpt')
        expect(result.data.version).toBe('0.0.0')
      }
    })
  })

  describe('preferences:get', () => {
    it('returns preference for valid key', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_GET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, 'theme')) as IpcResult<{ key: string; value: unknown }>
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.key).toBe('theme')
        expect(result.data.value).toBe('system')
      }
    })

    it('rejects invalid key', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_GET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, 'invalidKey')) as IpcResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('rejects non-string key', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_GET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, 123)) as IpcResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('preferences:set', () => {
    it('sets valid preference', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_SET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, { theme: 'dark' })) as IpcResult<{
        theme: string
        language: string
        reduceMotion: boolean
      }>
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.theme).toBe('dark')
      }
    })

    it('rejects invalid data', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_SET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, { theme: 'purple' })) as IpcResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('rejects non-object input', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_SET)
      expect(handler).toBeDefined()
      const result = (await handler!(null as never, 'invalid')) as IpcResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })
})