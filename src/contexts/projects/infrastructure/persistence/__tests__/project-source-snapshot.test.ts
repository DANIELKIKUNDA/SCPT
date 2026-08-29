import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { createProjectSourceSnapshotService } from '../project-source-snapshot'

const roots: string[] = []
const projectId = ProjetAudiovisuelId.from('01J00000000000000000000000')

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function databasePath(): string {
  const root = mkdtempSync(join(tmpdir(), 'scpt-source-version-'))
  roots.push(root)
  const path = join(root, 'project.sqlite')
  const db = new Database(path)
  db.exec(`
    CREATE TABLE scenes (
      id TEXT PRIMARY KEY, projet_id TEXT, ordre INTEGER, type TEXT,
      titre TEXT, narration_texte TEXT, texte_affiche TEXT, duree_ms INTEGER,
      composition_json TEXT, transition_json TEXT, version INTEGER, media_id TEXT
    );
  `)
  db.close()
  return path
}

describe('ProjectSourceSnapshotService', () => {
  it('starts source version at 1', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
    } finally {
      service.close()
    }
  })

  it('does not increment when the source fingerprint is unchanged', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
      expect(service.current(projectId).version.value).toBe(1)
    } finally {
      service.close()
    }
  })

  it('increments exactly once after source scene content changes', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
      const db = new Database(path)
      db.prepare(`INSERT INTO scenes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'scene-1', projectId.value, 1, 'texte', 'Titre', null, 'Texte', 2000,
        '{"backgroundColor":"#101828","layout":"centered"}',
        '{"type":"fade","durationMs":300}', 1, null
      )
      db.close()
      expect(service.current(projectId).version.value).toBe(2)
      expect(service.current(projectId).version.value).toBe(2)
    } finally {
      service.close()
    }
  })


  it('ignores an empty subtitle placeholder until it contains authored content', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
      const db = new Database(path)
      db.exec(`
        CREATE TABLE subtitle_tracks (
          id TEXT PRIMARY KEY, declinaison_id TEXT, langue TEXT, statut TEXT,
          version_narration INTEGER, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE subtitle_segments (
          id TEXT PRIMARY KEY, track_id TEXT, ordre INTEGER, debut_ms INTEGER,
          fin_ms INTEGER, texte TEXT, position TEXT, style_json TEXT
        );
      `)
      db.prepare('INSERT INTO subtitle_tracks VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        'track-1', 'placeholder', 'fr', 'brouillon', 1, 'old', 'old'
      )
      db.close()
      expect(service.current(projectId).version.value).toBe(1)

      const db2 = new Database(path)
      db2.prepare('INSERT INTO subtitle_segments VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        'seg-1', 'track-1', 1, 0, 1000, 'Bonjour', 'bas', null
      )
      db2.close()
      expect(service.current(projectId).version.value).toBe(2)
    } finally {
      service.close()
    }
  })

  it('ignores Phase 8 declination rows when computing the project source', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
      const db = new Database(path)
      db.exec('CREATE TABLE declinaisons (id TEXT PRIMARY KEY, project_id TEXT)')
      db.prepare('INSERT INTO declinaisons VALUES (?, ?)').run('d1', projectId.value)
      db.close()
      expect(service.current(projectId).version.value).toBe(1)
    } finally {
      service.close()
    }
  })

  it('ignores Phase 9 render job progress when computing the project source', () => {
    const path = databasePath()
    const service = createProjectSourceSnapshotService(path)
    try {
      expect(service.current(projectId).version.value).toBe(1)
      const db = new Database(path)
      db.exec('CREATE TABLE render_jobs (id TEXT PRIMARY KEY, project_id TEXT, statut TEXT, progression INTEGER)')
      db.prepare('INSERT INTO render_jobs VALUES (?, ?, ?, ?)').run('r1', projectId.value, 'en_composition', 25)
      db.prepare('UPDATE render_jobs SET progression = ? WHERE id = ?').run(80, 'r1')
      db.close()
      expect(service.current(projectId).version.value).toBe(1)
    } finally {
      service.close()
    }
  })
})
