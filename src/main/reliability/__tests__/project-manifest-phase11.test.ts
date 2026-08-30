import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => tmpdir()) } }))
vi.mock('../../logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

import {
  DATABASE_SCHEMA_VERSION,
  MANIFEST_FORMAT_VERSION,
  ProjectManifestService
} from '../../persistence/project-manifest'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function fixture(): { root: string; service: ProjectManifestService } {
  const root = mkdtempSync(join(tmpdir(), 'scpt-manifest11-'))
  roots.push(root)
  return { root, service: new ProjectManifestService(root) }
}

const metadata = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  titre: 'Logarithmes',
  type: 'cours',
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  appVersion: '1.0.0'
}

describe('ProjectManifestService Phase 11', () => {
  it('creates the current recovery/version envelope and mandatory directories', () => {
    const { service } = fixture()
    const manifest = service.createCurrent(metadata)
    expect(manifest.formatVersion).toBe(MANIFEST_FORMAT_VERSION)
    expect(manifest.databaseSchemaVersion).toBe(DATABASE_SCHEMA_VERSION)
    expect(manifest.databasePath).toBe('database/project.sqlite')
    expect(service.exists(metadata.id)).toBe(true)
    expect(service.getDatabasePath(metadata.id)).toContain(join('database', 'project.sqlite'))
    expect(readFileSync(service.getManifestPath(metadata.id), 'utf-8')).toContain('lastCleanCloseAt')
  })

  it('patches nested recovery state without erasing other recovery metadata', () => {
    const { service } = fixture()
    service.createCurrent(metadata)
    service.patchManifest(metadata.id, { recovery: { lastAuditAt: 'audit-at' } })
    const patched = service.patchManifest(metadata.id, { recovery: { lastSnapshotAt: 'snapshot-at' } })
    expect(patched.recovery.lastAuditAt).toBe('audit-at')
    expect(patched.recovery.lastSnapshotAt).toBe('snapshot-at')
    expect(patched.recovery.lastRestoreAt).toBeNull()
  })

  it('refuses a project format newer than this application', () => {
    const { service } = fixture()
    service.createCurrent(metadata)
    const path = service.getManifestPath(metadata.id)
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    raw.formatVersion = MANIFEST_FORMAT_VERSION + 1
    writeFileSync(path, JSON.stringify(raw), 'utf-8')
    expect(() => service.readManifestStrict(metadata.id)).toThrow('PROJECT_FORMAT_NEWER_THAN_APP')
  })

  it('refuses a manifest whose project identity does not match its folder', () => {
    const { service } = fixture()
    service.createCurrent(metadata)
    const path = service.getManifestPath(metadata.id)
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    raw.id = 'OTHER-PROJECT'
    writeFileSync(path, JSON.stringify(raw), 'utf-8')
    expect(() => service.readManifestStrict(metadata.id)).toThrow('PROJECT_MANIFEST_ID_MISMATCH')
  })

  it('normalizes legacy optional recovery/version fields without inventing project data', () => {
    const { service } = fixture()
    service.ensureProjectDirectories(metadata.id)
    writeFileSync(service.getManifestPath(metadata.id), JSON.stringify({
      id: metadata.id,
      titre: metadata.titre,
      type: metadata.type,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      formatVersion: 1,
      databasePath: 'database/project.sqlite'
    }), 'utf-8')
    const legacy = service.readManifestStrict(metadata.id)
    expect(legacy.databaseSchemaVersion).toBe(0)
    expect(legacy.createdWithAppVersion).toBe('legacy')
    expect(legacy.recovery.lastCleanCloseAt).toBeNull()
  })
})
