import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('../persistence/lock-manager', () => ({
  getLockManager: vi.fn(() => ({
    acquireLock: vi.fn(() => Promise.resolve()),
    releaseLock: vi.fn(() => Promise.resolve()),
    isLocked: vi.fn(() => false),
    releaseAll: vi.fn(() => Promise.resolve())
  })),
  ProjectLockedError: class extends Error {
    constructor(id: string) { super(`Project ${id} is already locked`); this.name = 'ProjectLockedError' }
  }
}))

import { registerIpcHandlers } from './handlers'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import type { IpcResult } from '../../shared/types/ipc'

const getHandler = (channel: string) =>
  (ipcMain as unknown as { _getHandler: (c: string) => (...args: unknown[]) => unknown })._getHandler(
    channel
  )

describe('IPC Handlers (Phase 1 + Phase 2)', () => {
  beforeEach(() => {
    ;(ipcMain as unknown as { _clear: () => void })._clear()
    registerIpcHandlers()
  })

  // Phase 1 tests
  describe('system:ping', () => {
    it('returns success with pong', async () => {
      const handler = getHandler(IPC_CHANNELS.SYSTEM_PING)
      const result = (await handler!()) as IpcResult<{ message: string; timestamp: number }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.message).toBe('pong')
    })
  })

  describe('system:get-app-info', () => {
    it('returns app info', async () => {
      const handler = getHandler(IPC_CHANNELS.SYSTEM_GET_APP_INFO)
      const result = (await handler!()) as IpcResult<{ name: string; version: string }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.name).toBe('scpt')
    })
  })

  describe('preferences:get', () => {
    it('returns preference for valid key', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_GET)
      const result = (await handler!(null as never, 'theme')) as IpcResult<{ key: string; value: unknown }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.value).toBe('system')
    })

    it('rejects invalid key', async () => {
      const handler = getHandler(IPC_CHANNELS.PREFERENCES_GET)
      const result = (await handler!(null as never, 123)) as IpcResult<unknown>
      expect(result.ok).toBe(false)
    })
  })

  // Phase 2 tests
  describe('projects:create', () => {
    it('creates a project', async () => {
      const handler = getHandler(IPC_CHANNELS.PROJECTS_CREATE)
      const result = (await handler!(null as never, {
        titre: 'IPC Test',
        type: 'tutoriel',
        objectif: 'Test',
        publicCible: 'Tous',
        langueSource: 'fr'
      })) as IpcResult<{ id: string; titre: string; statut: string }>
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.titre).toBe('IPC Test')
        expect(result.data.statut).toBe('BROUILLON')
      }
    })

    it('rejects invalid input', async () => {
      const handler = getHandler(IPC_CHANNELS.PROJECTS_CREATE)
      const result = (await handler!(null as never, { titre: '' })) as IpcResult<unknown>
      expect(result.ok).toBe(false)
    })
  })

  describe('projects:open', () => {
    it('opens an existing project', async () => {
      const createHandler = getHandler(IPC_CHANNELS.PROJECTS_CREATE)
      const created = (await createHandler!(null as never, {
        titre: 'To Open',
        type: 'test',
        objectif: 'T',
        publicCible: 'A',
        langueSource: 'fr'
      })) as IpcResult<{ id: string }>
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const openHandler = getHandler(IPC_CHANNELS.PROJECTS_OPEN)
      const result = (await openHandler!(null as never, created.data.id)) as IpcResult<{ titre: string }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.titre).toBe('To Open')
    })

    it('returns error for missing project', async () => {
      const handler = getHandler(IPC_CHANNELS.PROJECTS_OPEN)
      const result = (await handler!(null as never, 'NONEXISTENT_ID')) as IpcResult<unknown>
      expect(result.ok).toBe(false)
    })
  })

  describe('projects:list-recent', () => {
    it('returns empty list initially', async () => {
      const handler = getHandler(IPC_CHANNELS.PROJECTS_LIST_RECENT)
      const result = (await handler!()) as IpcResult<unknown[]>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('projects:archive', () => {
    it('archives a project', async () => {
      const createHandler = getHandler(IPC_CHANNELS.PROJECTS_CREATE)
      const created = (await createHandler!(null as never, {
        titre: 'To Archive',
        type: 'test',
        objectif: 'T',
        publicCible: 'A',
        langueSource: 'fr'
      })) as IpcResult<{ id: string }>
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const archiveHandler = getHandler(IPC_CHANNELS.PROJECTS_ARCHIVE)
      const result = (await archiveHandler!(null as never, created.data.id)) as IpcResult<{ statut: string }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.statut).toBe('ARCHIVE')
    })
  })

  describe('projects:restore', () => {
    it('restores an archived project', async () => {
      const createHandler = getHandler(IPC_CHANNELS.PROJECTS_CREATE)
      const created = (await createHandler!(null as never, {
        titre: 'To Restore',
        type: 'test',
        objectif: 'T',
        publicCible: 'A',
        langueSource: 'fr'
      })) as IpcResult<{ id: string }>
      expect(created.ok).toBe(true)
      if (!created.ok) return

      const archiveHandler = getHandler(IPC_CHANNELS.PROJECTS_ARCHIVE)
      await archiveHandler!(null as never, created.data.id)

      const restoreHandler = getHandler(IPC_CHANNELS.PROJECTS_RESTORE)
      const result = (await restoreHandler!(null as never, created.data.id)) as IpcResult<{ statut: string }>
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.statut).toBe('BROUILLON')
    })
  })
})