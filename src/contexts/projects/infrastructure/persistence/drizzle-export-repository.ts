import Database from 'better-sqlite3'
import {
  ExportAudiovisuel,
  type ExportAudiovisuelStatus
} from '../../domain/aggregates/export-audiovisuel'
import type { ExportAudiovisuelRepository } from '../../domain/repositories/export-audiovisuel.repository'
import { DeclinaisonId } from '../../domain/value-objects/declinaison-id'
import { ExportId } from '../../domain/value-objects/export-id'
import { ProfilExport } from '../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'

interface RenderJobRow {
  id: string
  project_id: string
  declinaison_id: string
  tentative: number
  statut: string
  progression: number
  chemin_fichier: string | null
  checksum: string | null
  diagnostic: string | null
  profil: string
  version_project_source: number
  version_declinaison_source: number
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

const ACTIVE_STATUSES: ExportAudiovisuelStatus[] = [
  'demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification'
]

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      declinaison_id TEXT NOT NULL,
      tentative INTEGER NOT NULL,
      statut TEXT NOT NULL,
      progression INTEGER NOT NULL DEFAULT 0,
      chemin_fichier TEXT,
      checksum TEXT,
      diagnostic TEXT,
      profil TEXT NOT NULL,
      version_project_source INTEGER NOT NULL,
      version_declinaison_source INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_render_jobs_declinaison ON render_jobs(declinaison_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(project_id, statut, updated_at);
  `)
}

function mapRow(row: RenderJobRow): ExportAudiovisuel {
  return ExportAudiovisuel.fromPersistence({
    id: ExportId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.project_id),
    declinaisonId: DeclinaisonId.from(row.declinaison_id),
    tentative: row.tentative,
    statut: row.statut as ExportAudiovisuelStatus,
    progression: row.progression,
    cheminFichier: row.chemin_fichier,
    checksum: row.checksum,
    diagnostic: row.diagnostic,
    profil: ProfilExport.from(row.profil),
    versionsSources: {
      versionProjetSource: VersionMetier.from(row.version_project_source),
      versionDeclinaison: VersionMetier.from(row.version_declinaison_source)
    },
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    finishedAt: row.finished_at ? new Date(row.finished_at) : null
  })
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

export function createDrizzleExportRepository(
  dbPath: string
): ExportAudiovisuelRepository & { close(): void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureSchema(db)

  const upsert = db.prepare(`
    INSERT INTO render_jobs (
      id, project_id, declinaison_id, tentative, statut, progression, chemin_fichier,
      checksum, diagnostic, profil, version_project_source, version_declinaison_source,
      created_at, updated_at, started_at, finished_at
    ) VALUES (
      @id, @project_id, @declinaison_id, @tentative, @statut, @progression, @chemin_fichier,
      @checksum, @diagnostic, @profil, @version_project_source, @version_declinaison_source,
      @created_at, @updated_at, @started_at, @finished_at
    )
    ON CONFLICT(id) DO UPDATE SET
      tentative = excluded.tentative,
      statut = excluded.statut,
      progression = excluded.progression,
      chemin_fichier = excluded.chemin_fichier,
      checksum = excluded.checksum,
      diagnostic = excluded.diagnostic,
      profil = excluded.profil,
      version_project_source = excluded.version_project_source,
      version_declinaison_source = excluded.version_declinaison_source,
      updated_at = excluded.updated_at,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at
  `)

  return {
    async save(value): Promise<void> {
      const row = value.toJSON()
      upsert.run({
        id: row.id.value,
        project_id: row.projetId.value,
        declinaison_id: row.declinaisonId.value,
        tentative: row.tentative,
        statut: row.statut,
        progression: row.progression,
        chemin_fichier: row.cheminFichier,
        checksum: row.checksum,
        diagnostic: row.diagnostic,
        profil: row.profil.value,
        version_project_source: row.versionsSources.versionProjetSource.value,
        version_declinaison_source: row.versionsSources.versionDeclinaison.value,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
        started_at: row.startedAt?.toISOString() ?? null,
        finished_at: row.finishedAt?.toISOString() ?? null
      })
    },

    async findById(id): Promise<ExportAudiovisuel | null> {
      const row = db.prepare('SELECT * FROM render_jobs WHERE id = ?').get(id.value) as RenderJobRow | undefined
      return row ? mapRow(row) : null
    },

    async findAllByProject(projectId): Promise<ExportAudiovisuel[]> {
      const rows = db.prepare(`
        SELECT * FROM render_jobs WHERE project_id = ?
        ORDER BY created_at DESC, id DESC
      `).all(projectId.value) as RenderJobRow[]
      return rows.map(mapRow)
    },

    async findActiveByDeclinaison(declinaisonId): Promise<ExportAudiovisuel | null> {
      const row = db.prepare(`
        SELECT * FROM render_jobs
        WHERE declinaison_id = ? AND statut IN (${placeholders(ACTIVE_STATUSES.length)})
        ORDER BY created_at DESC LIMIT 1
      `).get(declinaisonId.value, ...ACTIVE_STATUSES) as RenderJobRow | undefined
      return row ? mapRow(row) : null
    },

    async findByStatuses(projectId, statuses): Promise<ExportAudiovisuel[]> {
      if (statuses.length === 0) return []
      const rows = db.prepare(`
        SELECT * FROM render_jobs
        WHERE project_id = ? AND statut IN (${placeholders(statuses.length)})
        ORDER BY created_at ASC, id ASC
      `).all(projectId.value, ...statuses) as RenderJobRow[]
      return rows.map(mapRow)
    },

    async maxAttemptForDeclinaison(declinaisonId): Promise<number> {
      const row = db.prepare('SELECT COALESCE(MAX(tentative), 0) AS attempt FROM render_jobs WHERE declinaison_id = ?')
        .get(declinaisonId.value) as { attempt: number }
      return row.attempt
    },

    close(): void {
      db.close()
    }
  }
}
