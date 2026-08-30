import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectTaskBoard } from '../task-board'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-tasks11-'))
  roots.push(root)
  const dbPath = join(root, 'project.sqlite')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE project_source_state (project_id TEXT PRIMARY KEY, version INTEGER, fingerprint TEXT, updated_at TEXT);
    INSERT INTO project_source_state VALUES ('p1', 3, 'fp', '2026-01-01');
    CREATE TABLE render_jobs (
      id TEXT PRIMARY KEY, project_id TEXT, declinaison_id TEXT, tentative INTEGER, statut TEXT,
      progression INTEGER, diagnostic TEXT, version_project_source INTEGER, created_at TEXT, updated_at TEXT, finished_at TEXT
    );
    CREATE TABLE final_exports (
      id TEXT PRIMARY KEY, project_id TEXT, render_job_id TEXT, tentative INTEGER, statut TEXT,
      progression INTEGER, diagnostic TEXT, created_at TEXT, updated_at TEXT, finished_at TEXT
    );
  `)
  return { root, dbPath, db }
}

describe('ProjectTaskBoard', () => {
  it('combines render and final-export history in reverse chronological order', () => {
    const { db, dbPath } = fixture()
    db.prepare('INSERT INTO render_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('r1', 'p1', 'd1', 1, 'termine', 100, null, 3, '2026-01-01', '2026-01-01', '2026-01-01')
    db.prepare('INSERT INTO final_exports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('f1', 'p1', 'r1', 1, 'termine', 100, null, '2026-01-02', '2026-01-02', '2026-01-02')
    db.close()
    const tasks = new ProjectTaskBoard(dbPath).list('p1')
    expect(tasks.map((task) => task.id)).toEqual(['f1', 'r1'])
    expect(tasks.map((task) => task.kind)).toEqual(['final_export', 'render'])
  })

  it('marks interrupted statuses as active', () => {
    const { db, dbPath } = fixture()
    db.prepare('INSERT INTO render_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('r1', 'p1', 'd1', 2, 'en_composition', 42, 'working', 3, '2026-01-01', '2026-01-01', null)
    db.close()
    const [task] = new ProjectTaskBoard(dbPath).list('p1')
    expect(task.active).toBe(true)
    expect(task.progress).toBe(42)
    expect(task.attempt).toBe(2)
  })

  it('preserves old tasks but marks them obsolete after the project source version advances', () => {
    const { db, dbPath } = fixture()
    db.prepare('INSERT INTO render_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('r-old', 'p1', 'd1', 1, 'termine', 100, null, 2, '2026-01-01', '2026-01-01', '2026-01-01')
    db.prepare('INSERT INTO final_exports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('f-old', 'p1', 'r-old', 1, 'termine', 100, null, '2026-01-02', '2026-01-02', '2026-01-02')
    db.close()
    const tasks = new ProjectTaskBoard(dbPath).list('p1')
    expect(tasks).toHaveLength(2)
    expect(tasks.every((task) => task.obsolete)).toBe(true)
  })
})
