import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'
import { ulid } from 'ulid'

/**
 * REAL lock test — proper-lockfile via actual filesystem.
 * proper-lockfile on Windows requires the lock file parent directory
 * to exist and uses the lock file path as an advisory lock target.
 */
describe('LockManager (real proper-lockfile)', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(process.env['TEMP'] || '/tmp', `scpt-lock-${ulid()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('A acquires lock → B fails → A releases → B succeeds', async () => {
    const lockPath = join(testDir, 'project.lock')

    // Ensure the lock file exists (proper-lockfile needs it on Windows)
    if (!existsSync(lockPath)) {
      writeFileSync(lockPath, '', 'utf-8')
    }

    // A acquires lock
    const lockfile = await import('proper-lockfile')
    const releaseA = await lockfile.lock(lockPath, { retries: 0, realpath: false })
    expect(typeof releaseA).toBe('function')

    // B tries to acquire same lock — should fail
    await expect(
      lockfile.lock(lockPath, { retries: 0, realpath: false })
    ).rejects.toThrow()

    // A releases
    await releaseA()

    // B acquires successfully
    const releaseB = await lockfile.lock(lockPath, { retries: 0, realpath: false })
    expect(typeof releaseB).toBe('function')
    await releaseB()
  })

  it('re-acquires lock immediately after release', async () => {
    const lockPath = join(testDir, 'project.lock')
    if (!existsSync(lockPath)) {
      writeFileSync(lockPath, '', 'utf-8')
    }

    const lockfile = await import('proper-lockfile')
    const release = await lockfile.lock(lockPath, { retries: 0, realpath: false })
    await release()

    // Should be able to re-acquire
    const release2 = await lockfile.lock(lockPath, { retries: 0, realpath: false })
    expect(typeof release2).toBe('function')
    await release2()
  })
})