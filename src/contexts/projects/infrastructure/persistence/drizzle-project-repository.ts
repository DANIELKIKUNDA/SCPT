import Database from 'better-sqlite3'
import { ProjetAudiovisuel, type ProjetAudiovisuelProps } from '../../domain/aggregates/projet-audiovisuel'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'
import type { StatutProjet } from '../../domain/value-objects/statut-projet'

interface ProjectRow {
  id: string
  titre: string
  type: string
  objectif: string
  public_cible: string
  langue_source: string
  statut: string
  version: number
  created_at: string
  updated_at: string
  archived_at: string | null
  previous_statut: string | null
}

function domainToRow(project: ProjetAudiovisuel): ProjectRow {
  return {
    id: project.id.value,
    titre: project.titre,
    type: project.type,
    objectif: project.objectif,
    public_cible: project.publicCible,
    langue_source: project.langueSource,
    statut: project.statut,
    version: project.version,
    created_at: project.createdAt.toISOString(),
    updated_at: project.updatedAt.toISOString(),
    archived_at: project.archivedAt?.toISOString() ?? null,
    previous_statut: project.previousStatut ?? null
  }
}

function rowToDomain(row: ProjectRow): ProjetAudiovisuel {
  const props: ProjetAudiovisuelProps = {
    id: ProjetAudiovisuelId.from(row.id),
    titre: row.titre,
    type: row.type,
    objectif: row.objectif ?? '',
    publicCible: row.public_cible ?? '',
    langueSource: row.langue_source,
    statut: row.statut as StatutProjet,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    previousStatut: (row.previous_statut as StatutProjet) ?? null
  }
  return ProjetAudiovisuel.fromPersistence(props)
}

export function createSqliteProjectRepository(dbPath: string): ProjetAudiovisuelRepository {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      titre TEXT NOT NULL,
      type TEXT NOT NULL,
      objectif TEXT NOT NULL DEFAULT '',
      public_cible TEXT NOT NULL DEFAULT '',
      langue_source TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'BROUILLON',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      previous_statut TEXT
    )
  `)

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO projects (id, titre, type, objectif, public_cible, langue_source, statut, version, created_at, updated_at, archived_at, previous_statut)
    VALUES (@id, @titre, @type, @objectif, @public_cible, @langue_source, @statut, @version, @created_at, @updated_at, @archived_at, @previous_statut)
  `)

  const findByIdStmt = db.prepare('SELECT * FROM projects WHERE id = ?')
  const findRecentStmt = db.prepare(
    "SELECT * FROM projects WHERE statut != 'ARCHIVE' ORDER BY updated_at DESC LIMIT ?"
  )
  const findArchivedStmt = db.prepare(
    "SELECT * FROM projects WHERE statut = 'ARCHIVE' ORDER BY updated_at DESC"
  )
  const deleteStmt = db.prepare('DELETE FROM projects WHERE id = ?')

  return {
    async save(project: ProjetAudiovisuel): Promise<void> {
      insertStmt.run(domainToRow(project))
    },

    async findById(id: ProjetAudiovisuelId): Promise<ProjetAudiovisuel | null> {
      const row = findByIdStmt.get(id.value) as ProjectRow | undefined
      if (!row) return null
      return rowToDomain(row)
    },

    async findAll(): Promise<ProjetAudiovisuel[]> {
      const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
      return rows.map(rowToDomain)
    },

    async findRecent(limit: number): Promise<ProjetAudiovisuel[]> {
      const rows = findRecentStmt.all(limit) as ProjectRow[]
      return rows.map(rowToDomain)
    },

    async findArchived(): Promise<ProjetAudiovisuel[]> {
      const rows = findArchivedStmt.all() as ProjectRow[]
      return rows.map(rowToDomain)
    },

    async delete(id: ProjetAudiovisuelId): Promise<void> {
      deleteStmt.run(id.value)
    }
  }
}