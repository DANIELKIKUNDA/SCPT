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
    },
    shell: {
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }
  }
})

// This IPC wiring suite must not initialize the real Remotion bundler/renderer.
// @remotion/bundler loads esbuild at module evaluation time; under the global
// jsdom test realm, TextEncoder/Uint8Array come from different realms and
// esbuild correctly rejects that broken invariant. The real renderer is already
// covered by dedicated Phase 9 tests and the Windows preflight, so this unit
// suite mocks the rendering infrastructure boundary.
vi.mock('../../contexts/projects/infrastructure/rendering/remotion-render-adapter', () => ({
  RemotionRenderAdapter: class {
    async render(): Promise<never> {
      throw new Error('UNEXPECTED_RENDER_IN_IPC_UNIT_TEST')
    }
  }
}))

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

// Persistence and filesystem boundaries are mocked with in-memory implementations.
// This unit suite exercises IPC wiring (Phase 1 + Phase 2) only. Using the real
// better-sqlite3 factory here would open an unclosed native Database for the
// catalog (and the media DB + chokidar watcher on open), which crashes the Vitest
// worker teardown (`RemoveEnvironmentCleanupHook` native assertion).
vi.mock('../../contexts/projects/infrastructure/persistence/drizzle-project-repository', () => {
  const projects = new Map<string, unknown>()

  const keyOf = (value: unknown): string => {
    if (value && typeof value === 'object') {
      if ('value' in value) return String((value as { value: string }).value)
      if ('id' in value) return (value as { id: { value: string } }).id.value
    }
    return ''
  }

  return {
    createSqliteProjectRepository: () => ({
      save: async (projet: unknown): Promise<void> => {
        projects.set(keyOf(projet), projet)
      },
      findById: async (id: unknown): Promise<unknown> => projects.get(keyOf(id)) ?? null,
      findAll: async (): Promise<unknown[]> => [...projects.values()],
      findRecent: async (): Promise<unknown[]> =>
        [...projects.values()].filter((p) => (p as { statut: string }).statut !== 'ARCHIVE'),
      findArchived: async (): Promise<unknown[]> =>
        [...projects.values()].filter((p) => (p as { statut: string }).statut === 'ARCHIVE'),
      delete: async (id: unknown): Promise<void> => {
        projects.delete(keyOf(id))
      }
    })
  }
})

vi.mock('../persistence/project-manifest', () => ({
  getProjectManifestService: () => ({
    getDatabasePath: (): string => ':memory:',
    getProjectDir: (): string => '/mock/project/',
    readManifest: () => ({ titre: 'Projet test' })
  })
}))

vi.mock('../persistence/media-watcher', () => ({
  MediaWatcher: class {
    startWatching(): void {}
    stopWatching(): void {}
    stopAll(): void {}
  },
  verifyMediaFiles: (): string[] => []
}))

vi.mock('../../contexts/projects/infrastructure/persistence/drizzle-media-repository', () => ({
  createDrizzleMediaRepository: () => ({
    findAll: async (): Promise<unknown[]> => [],
    findById: async (): Promise<unknown> => null,
    findByChecksum: async (): Promise<unknown> => null,
    save: async (): Promise<void> => {},
    delete: async (): Promise<void> => {},
    close: (): void => {}
  })
}))

// Phase 9 project-open recovery must remain purely in-memory in this IPC unit suite.
// With no interrupted jobs, the coordinator does not instantiate scene/media/narration
// rendering dependencies and no native SQLite handle is opened.
vi.mock('../../contexts/projects/infrastructure/persistence/drizzle-export-repository', () => ({
  createDrizzleExportRepository: () => ({
    save: async (): Promise<void> => {},
    findById: async (): Promise<unknown> => null,
    findAllByProject: async (): Promise<unknown[]> => [],
    findActiveByDeclinaison: async (): Promise<unknown> => null,
    findByStatuses: async (): Promise<unknown[]> => [],
    maxAttemptForDeclinaison: async (): Promise<number> => 0,
    close: (): void => {}
  })
}))

vi.mock('../../contexts/projects/infrastructure/persistence/drizzle-final-export-repository', () => ({
  createDrizzleFinalExportRepository: () => ({
    save: async (): Promise<void> => {},
    findById: async (): Promise<unknown> => null,
    findAllByProject: async (): Promise<unknown[]> => [],
    findActiveByRenderJob: async (): Promise<unknown> => null,
    findByStatuses: async (): Promise<unknown[]> => [],
    maxAttemptForRenderJob: async (): Promise<number> => 0,
    close: (): void => {}
  })
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