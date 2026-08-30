import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuditEntryRecord, ReliabilityRepository } from '../../../contexts/projects/application/ports/reliability-repository.port'
import type { ProjectManifestData } from '../../persistence/project-manifest'
import { ProjectAuditService } from '../project-audit'

vi.mock('../../logging/logger', () => ({
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  }
}))

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })

function sha(text: string): string { return createHash('sha256').update(text).digest('hex') }

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-audit11-'))
  roots.push(root)
  for (const dir of [
    'database', 'media/source', 'audio/narration', 'audio/temp', 'subtitles', 'renders/previews', 'renders/final',
    'logs', 'backups', 'recovery', 'temp/rendering', 'temp/exporting', 'temp/restoring'
  ]) mkdirSync(join(root, ...dir.split('/')), { recursive: true })
  const dbPath = join(root, 'database', 'project.sqlite')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE ressources_media (
      id TEXT PRIMARY KEY, projet_id TEXT, chemin_relatif TEXT, checksum TEXT, statut TEXT
    );
    CREATE TABLE render_jobs (
      id TEXT PRIMARY KEY, project_id TEXT, statut TEXT, chemin_fichier TEXT, checksum TEXT
    );
    CREATE TABLE final_exports (
      id TEXT PRIMARY KEY, project_id TEXT, statut TEXT, chemin_fichier TEXT, checksum TEXT
    );
  `)
  db.close()
  const saved: AuditEntryRecord[] = []
  const repository: ReliabilityRepository = {
    saveAudit: async (entry) => { saved.push(entry) },
    listAudits: async () => saved,
    saveMigration: async () => undefined,
    hasMigration: async () => false,
    close: () => undefined
  }
  const manifest: ProjectManifestData = {
    id: 'p1', titre: 'Cours', type: 'cours', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    formatVersion: 2, databasePath: 'database/project.sqlite', databaseSchemaVersion: 1,
    createdWithAppVersion: '1.0.0', lastOpenedWithAppVersion: '1.0.0', lastOpenedAt: null,
    recovery: { lastCleanCloseAt: null, lastAuditAt: null, lastSnapshotAt: null, lastRestoreAt: null }
  }
  return { root, dbPath, saved, repository, manifest, service: new ProjectAuditService(root, repository) }
}

describe('ProjectAuditService', () => {
  it('produces a structured checklist and persists the audit result', async () => {
    const f = fixture()
    const audit = await f.service.run({ projectId: 'p1', manifest: f.manifest, crashDetected: false })
    expect(audit.checklist.map((item) => item.id)).toEqual(['version', 'database', 'media', 'outputs', 'tasks', 'temporary', 'backup'])
    expect(audit.anomalies.some((item) => item.code === 'NO_RECOVERY_SNAPSHOT')).toBe(true)
    expect(f.saved).toHaveLength(1)
  })

  it('blocks when a referenced media file is missing', async () => {
    const f = fixture()
    const db = new Database(f.dbPath)
    db.prepare('INSERT INTO ressources_media VALUES (?, ?, ?, ?, ?)')
      .run('m1', 'p1', 'media/source/missing.png', sha('expected'), 'disponible')
    db.close()
    const audit = await f.service.run({ projectId: 'p1', manifest: f.manifest, crashDetected: false })
    expect(audit.status).toBe('blocked')
    expect(audit.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MEDIA_FILE_MISSING', severity: 'blocking' })]))
  })

  it('blocks when a completed immutable final export checksum no longer matches', async () => {
    const f = fixture()
    const output = join(f.root, 'renders', 'final', 'final.mp4')
    writeFileSync(output, 'tampered')
    const db = new Database(f.dbPath)
    db.prepare('INSERT INTO final_exports VALUES (?, ?, ?, ?, ?)')
      .run('f1', 'p1', 'termine', 'renders/final/final.mp4', sha('original'))
    db.close()
    const audit = await f.service.run({ projectId: 'p1', manifest: f.manifest, crashDetected: false })
    expect(audit.status).toBe('blocked')
    expect(audit.anomalies.some((item) => item.code === 'FINAL_EXPORT_CORRUPTED')).toBe(true)
  })

  it('reports an unclean previous session and abandoned temporaries as recoverable warnings', async () => {
    const f = fixture()
    mkdirSync(join(f.root, 'temp', 'rendering', 'stale-job'), { recursive: true })
    writeFileSync(join(f.root, 'temp', 'rendering', 'stale-job', 'chunk.tmp'), 'x')
    const audit = await f.service.run({ projectId: 'p1', manifest: f.manifest, crashDetected: true })
    expect(audit.anomalies.map((item) => item.code)).toEqual(expect.arrayContaining(['UNCLEAN_PREVIOUS_SESSION', 'TEMPORARY_FILES_PRESENT']))
    expect(audit.status).toBe('attention')
  })
})
