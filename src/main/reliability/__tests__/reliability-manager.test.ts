import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => tmpdir()) } }))
vi.mock('../../logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

import { ProjectManifestService } from '../../persistence/project-manifest'
import { RecoverySessionService } from '../recovery-session'
import { ProjectReliabilityManager } from '../reliability-manager'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })

const project = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  titre: 'Cours',
  type: 'cours',
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z'
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-manager11-'))
  roots.push(root)
  const manifests = new ProjectManifestService(root)
  return { root, manifests, manager: new ProjectReliabilityManager(manifests, () => '1.0.0') }
}

describe('ProjectReliabilityManager', () => {
  it('initializes a new project with manifest and versioned reliability schema', async () => {
    const f = fixture()
    await f.manager.initializeNewProject(project)
    const manifest = f.manifests.readManifestStrict(project.id)
    expect(manifest.formatVersion).toBe(2)
    expect(manifest.databaseSchemaVersion).toBe(1)
    const db = new Database(f.manifests.getDatabasePath(project.id), { readonly: true })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_entries'").get()).toBeTruthy()
    expect(db.prepare('SELECT id FROM migrations WHERE id = ?').get('phase11-reliability-v1')).toBeTruthy()
    db.close()
  })

  it('migrates a legacy manifest only after creating a migration snapshot', async () => {
    const f = fixture()
    f.manifests.ensureProjectDirectories(project.id)
    f.manifests.writeManifest({
      ...project, formatVersion: 1, databasePath: 'database/project.sqlite', databaseSchemaVersion: 0,
      createdWithAppVersion: 'legacy', lastOpenedWithAppVersion: 'legacy', lastOpenedAt: null,
      recovery: { lastCleanCloseAt: null, lastAuditAt: null, lastSnapshotAt: null, lastRestoreAt: null }
    })
    const overview = await f.manager.prepareOpen(project)
    expect(overview.versions.formatVersion).toBe(2)
    expect(overview.backups.some((backup) => backup.kind === 'migration')).toBe(true)
    expect(f.manifests.readManifestStrict(project.id).databaseSchemaVersion).toBe(1)
  })

  it('detects an unclean session, removes abandoned temporaries and keeps a new marker active', async () => {
    const f = fixture()
    await f.manager.initializeNewProject(project)
    const projectDir = f.manifests.getProjectDir(project.id)
    await new RecoverySessionService(projectDir).markOpen(project.id)
    const stale = join(projectDir, 'temp', 'rendering', 'stale', 'chunk.tmp')
    mkdirSync(join(projectDir, 'temp', 'rendering', 'stale'), { recursive: true })
    writeFileSync(stale, 'x')
    const overview = await f.manager.prepareOpen(project)
    expect(overview.crashRecovered).toBe(true)
    expect(existsSync(stale)).toBe(false)
    expect(await new RecoverySessionService(projectDir).detectPreviousCrash(project.id)).toBe(true)
  })

  it('does not create another automatic snapshot when only Phase 11 operational metadata changed', async () => {
    const f = fixture()
    await f.manager.initializeNewProject(project)
    const now = Date.now()
    const first = await f.manager.maybeCreateAutomaticSnapshot(project.id, now)
    expect(first).not.toBeNull()
    // Simulate audit metadata update; authored source and rendered products stay unchanged.
    f.manifests.patchManifest(project.id, { recovery: { lastAuditAt: '2026-08-30T00:01:00Z' } })
    const second = await f.manager.maybeCreateAutomaticSnapshot(project.id, now + 16 * 60 * 1000)
    expect(second).toBeNull()
  })

  it('restores SQLite from a validated snapshot and always creates a pre-restore safety snapshot', async () => {
    const f = fixture()
    await f.manager.initializeNewProject(project)
    const dbPath = f.manifests.getDatabasePath(project.id)
    let db = new Database(dbPath)
    db.exec('CREATE TABLE user_data (value TEXT); INSERT INTO user_data VALUES (\'before\');')
    db.close()
    const target = await f.manager.createManualSnapshot(project.id)
    db = new Database(dbPath)
    db.prepare('INSERT INTO user_data VALUES (?)').run('after')
    db.close()

    const result = await f.manager.restoreBackup(project.id, target.id)
    expect(result.restored).toBe(true)
    expect(result.requiresReopen).toBe(true)
    expect(result.safetyBackupId).not.toBe(target.id)
    db = new Database(dbPath, { readonly: true })
    expect((db.prepare('SELECT COUNT(*) AS count FROM user_data').get() as { count: number }).count).toBe(1)
    db.close()
    const backups = await f.manager.listBackups(project.id)
    expect(backups.some((backup) => backup.kind === 'pre_restore')).toBe(true)
    expect(JSON.parse(readFileSync(f.manifests.getManifestPath(project.id), 'utf-8')).recovery.lastRestoreAt).toBeTruthy()
  })
})
