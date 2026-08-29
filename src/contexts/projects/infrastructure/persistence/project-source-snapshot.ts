import { createHash } from 'crypto'
import Database from 'better-sqlite3'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'

interface SourceStateRow {
  project_id: string
  version: number
  fingerprint: string
}

interface SourceTableSpec {
  name: string
  columns: string
  orderBy: string
  where?: string
}

/**
 * Only semantic source fields enter the fingerprint. Operational timestamps are
 * excluded so reopening/saving identical data does not obsolete declinations.
 * Empty Phase 6/7 placeholder tracks are ignored until they contain authored
 * content, preventing infrastructure initialization from changing source state.
 */
const SOURCE_TABLES: SourceTableSpec[] = [
  {
    name: 'scenes',
    columns: 'id, projet_id, ordre, type, titre, narration_texte, texte_affiche, duree_ms, composition_json, transition_json, version, media_id',
    orderBy: 'ordre, id'
  },
  {
    name: 'ressources_media',
    columns: 'id, projet_id, type, chemin_relatif, nom_original, checksum, taille_octets, mime_type, duree_ms, largeur, hauteur, statut, droits, version, source_media_id',
    orderBy: 'id'
  },
  {
    name: 'narration_tracks',
    columns: 'id, projet_id, langue, prise_finale_id, statut, version_texte',
    orderBy: 'id',
    where: 'prise_finale_id IS NOT NULL OR EXISTS (SELECT 1 FROM narration_segments ns WHERE ns.track_id = narration_tracks.id)'
  },
  {
    name: 'narration_segments',
    columns: 'id, track_id, scene_id, ordre, texte, fichier_audio, duree_ms, statut, source, voix_id, checksum',
    orderBy: 'track_id, ordre, id'
  },
  {
    name: 'subtitle_tracks',
    columns: 'id, declinaison_id, langue, statut, version_narration',
    orderBy: 'id',
    where: "statut != 'brouillon' OR EXISTS (SELECT 1 FROM subtitle_segments ss WHERE ss.track_id = subtitle_tracks.id)"
  },
  {
    name: 'subtitle_segments',
    columns: 'id, track_id, ordre, debut_ms, fin_ms, texte, position, style_json',
    orderBy: 'track_id, ordre, id'
  }
]

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_source_state (
      project_id TEXT PRIMARY KEY NOT NULL,
      version INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { ok: number } | undefined
  return Boolean(row?.ok)
}

function stableRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))
}

export function computeProjectSourceFingerprint(db: Database.Database): string {
  const payload: Array<{ table: string; rows: Record<string, unknown>[] }> = []
  for (const spec of SOURCE_TABLES) {
    if (!tableExists(db, spec.name)) {
      payload.push({ table: spec.name, rows: [] })
      continue
    }
    const where = spec.where ? ` WHERE ${spec.where}` : ''
    const rows = db.prepare(
      `SELECT ${spec.columns} FROM ${spec.name}${where} ORDER BY ${spec.orderBy}`
    ).all() as Record<string, unknown>[]
    payload.push({ table: spec.name, rows: rows.map(stableRow) })
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export interface ProjectSourceSnapshot {
  version: VersionMetier
  fingerprint: string
}

export function createProjectSourceSnapshotService(dbPath: string): {
  current(projectId: ProjetAudiovisuelId): ProjectSourceSnapshot
  close(): void
} {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureSchema(db)

  const read = db.prepare('SELECT project_id, version, fingerprint FROM project_source_state WHERE project_id = ?')
  const insert = db.prepare(`
    INSERT INTO project_source_state (project_id, version, fingerprint, updated_at)
    VALUES (?, ?, ?, ?)
  `)
  const update = db.prepare(`
    UPDATE project_source_state
    SET version = ?, fingerprint = ?, updated_at = ?
    WHERE project_id = ?
  `)

  return {
    current(projectId): ProjectSourceSnapshot {
      const fingerprint = computeProjectSourceFingerprint(db)
      const row = read.get(projectId.value) as SourceStateRow | undefined
      if (!row) {
        insert.run(projectId.value, 1, fingerprint, new Date().toISOString())
        return { version: VersionMetier.initial(), fingerprint }
      }
      if (row.fingerprint === fingerprint) {
        return { version: VersionMetier.from(row.version), fingerprint }
      }
      const nextVersion = row.version + 1
      update.run(nextVersion, fingerprint, new Date().toISOString(), projectId.value)
      return { version: VersionMetier.from(nextVersion), fingerprint }
    },
    close(): void {
      db.close()
    }
  }
}
