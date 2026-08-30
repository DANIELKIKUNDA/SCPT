import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectBackupService } from '../project-backup'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-backup11-'))
  roots.push(root)
  for (const dir of ['database', 'media/source', 'audio/narration', 'subtitles', 'renders/previews', 'renders/final', 'logs', 'backups']) {
    mkdirSync(join(root, ...dir.split('/')), { recursive: true })
  }
  writeFileSync(join(root, 'project.scpt.json'), JSON.stringify({ id: 'p1', recovery: { lastAuditAt: null } }), 'utf-8')
  writeFileSync(join(root, 'media', 'source', 'image.txt'), 'media-v1')
  const db = new Database(join(root, 'database', 'project.sqlite'))
  db.exec(`
    CREATE TABLE scenes (id TEXT, projet_id TEXT, ordre INTEGER, type TEXT, titre TEXT, narration_texte TEXT,
      texte_affiche TEXT, duree_ms INTEGER, composition_json TEXT, transition_json TEXT, version INTEGER, media_id TEXT);
    CREATE TABLE audit_entries (id TEXT PRIMARY KEY, project_id TEXT, status TEXT, anomalies_json TEXT, checklist_json TEXT, created_at TEXT);
    INSERT INTO scenes VALUES ('s1','p1',1,'texte','A','N','T',1000,'{}','{}',1,NULL);
  `)
  db.close()
  return { root, service: new ProjectBackupService(root) }
}

const input = { projectId: 'p1', kind: 'manual' as const, appVersion: '1.0.0', projectFormatVersion: 2, databaseSchemaVersion: 1 }

describe('ProjectBackupService', () => {
  it('creates a consistent snapshot with manifest, SQLite and project-owned files', async () => {
    const { root, service } = fixture()
    const backup = await service.create(input)
    expect(backup.fileCount).toBeGreaterThanOrEqual(3)
    expect(backup.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(existsSync(join(root, 'backups', backup.id, 'snapshot', 'database', 'project.sqlite'))).toBe(true)
    expect(await service.validate(backup.id, 'p1')).toMatchObject({ backupId: backup.id, projectId: 'p1' })
  })

  it('excludes disposable, derived and operational files from recovery snapshots', async () => {
    const { root, service } = fixture()
    mkdirSync(join(root, 'audio', 'temp'), { recursive: true })
    mkdirSync(join(root, 'media', 'derived'), { recursive: true })
    mkdirSync(join(root, 'renders', 'failed'), { recursive: true })
    writeFileSync(join(root, 'audio', 'temp', 'working.wav'), 'temp')
    writeFileSync(join(root, 'media', 'derived', 'preview.png'), 'derived')
    writeFileSync(join(root, 'renders', 'failed', 'broken.mp4'), 'failed')
    writeFileSync(join(root, 'logs', 'session.log'), 'changes all the time')

    const backup = await service.create(input)
    const snapshot = join(root, 'backups', backup.id, 'snapshot')
    expect(existsSync(join(snapshot, 'media', 'source', 'image.txt'))).toBe(true)
    expect(existsSync(join(snapshot, 'audio', 'temp', 'working.wav'))).toBe(false)
    expect(existsSync(join(snapshot, 'media', 'derived', 'preview.png'))).toBe(false)
    expect(existsSync(join(snapshot, 'renders', 'failed', 'broken.mp4'))).toBe(false)
    expect(existsSync(join(snapshot, 'logs', 'session.log'))).toBe(false)
  })

  it('detects a corrupted snapshot by checksum before restoration', async () => {
    const { root, service } = fixture()
    const backup = await service.create(input)
    writeFileSync(join(root, 'backups', backup.id, 'snapshot', 'media', 'source', 'image.txt'), 'tampered')
    await expect(service.validate(backup.id, 'p1')).rejects.toThrow()
  })

  it('rejects restoring a snapshot belonging to a different project', async () => {
    const { service } = fixture()
    const backup = await service.create(input)
    await expect(service.validate(backup.id, 'p2')).rejects.toThrow('BACKUP_PROJECT_MISMATCH')
  })

  it('removes abandoned atomic .building directories without touching valid backups', async () => {
    const { root, service } = fixture()
    const backup = await service.create(input)
    mkdirSync(join(root, 'backups', '.building-abandoned'), { recursive: true })
    expect(await service.removeInvalidBuildingDirectories()).toBe(1)
    expect(existsSync(join(root, 'backups', backup.id))).toBe(true)
  })

  it('does not treat Phase 11 audit/recovery metadata updates as authored project changes', async () => {
    const { root, service } = fixture()
    const before = await service.currentSourceFingerprint()
    const manifest = JSON.parse(readFileSync(join(root, 'project.scpt.json'), 'utf-8')) as Record<string, unknown>
    manifest.recovery = { lastAuditAt: '2026-08-30T12:00:00Z' }
    writeFileSync(join(root, 'project.scpt.json'), JSON.stringify(manifest), 'utf-8')
    const db = new Database(join(root, 'database', 'project.sqlite'))
    db.prepare('INSERT INTO audit_entries VALUES (?, ?, ?, ?, ?, ?)').run('a1', 'p1', 'healthy', '[]', '[]', '2026-08-30')
    db.close()
    expect(await service.currentSourceFingerprint()).toBe(before)
  })

  it('detects new rendered output as a meaningful snapshot change', async () => {
    const { root, service } = fixture()
    const before = await service.currentSourceFingerprint()
    writeFileSync(join(root, 'renders', 'previews', 'preview.mp4'), 'video')
    expect(await service.currentSourceFingerprint()).not.toBe(before)
  })
})
