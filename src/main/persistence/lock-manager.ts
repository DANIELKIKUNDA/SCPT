import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { logger } from '../logging/logger'

/**
 * Manages per-project file locks to prevent concurrent openings.
 * Uses proper-lockfile for cross-process advisory file locking.
 *
 * Lock files are stored in: {userData}/locks/{projectId}.lock
 */
export class LockManager {
  private locksDir: string
  private activeLocks: Map<string, () => Promise<void>> = new Map()

  constructor() {
    this.locksDir = join(app.getPath('userData'), 'locks')
    if (!existsSync(this.locksDir)) {
      mkdirSync(this.locksDir, { recursive: true })
    }
  }

  /**
   * Acquire a lock for the given project.
   * Returns a promise that resolves if the lock was acquired,
   * or rejects with a specific error if already locked.
   */
  async acquireLock(projectId: string): Promise<void> {
    const lockPath = join(this.locksDir, `${projectId}.lock`)

    // Dynamic import to avoid bundling proper-lockfile in tests
    const lockfile = await import('proper-lockfile')

    try {
      const release = await lockfile.lock(lockPath, {
        stale: 30000, // Consider lock stale after 30s if process dies
        retries: 0 // Fail immediately if locked
      })
      this.activeLocks.set(projectId, release)
      logger.info({ projectId, lockPath }, 'Lock acquired')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('ELOCKED') || message.includes('already')) {
        throw new ProjectLockedError(projectId)
      }
      throw err
    }
  }

  /**
   * Release the lock for the given project.
   */
  async releaseLock(projectId: string): Promise<void> {
    const release = this.activeLocks.get(projectId)
    if (release) {
      try {
        await release()
        this.activeLocks.delete(projectId)
        logger.info({ projectId }, 'Lock released')
      } catch (err) {
        logger.warn({ projectId, err }, 'Failed to release lock gracefully')
        this.activeLocks.delete(projectId)
      }
    }
  }

  /**
   * Check if a project is currently locked.
   */
  isLocked(projectId: string): boolean {
    return this.activeLocks.has(projectId)
  }

  /**
   * Release all active locks (called on app quit).
   */
  async releaseAll(): Promise<void> {
    const ids = Array.from(this.activeLocks.keys())
    await Promise.all(ids.map(id => this.releaseLock(id)))
    logger.info({ count: ids.length }, 'All locks released')
  }
}

export class ProjectLockedError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} is already open in another instance`)
    this.name = 'ProjectLockedError'
  }
}

/** Singleton instance created when the app starts */
let instance: LockManager | null = null

export function getLockManager(): LockManager {
  if (!instance) {
    instance = new LockManager()
  }
  return instance
}

export function destroyLockManager(): void {
  instance = null
}