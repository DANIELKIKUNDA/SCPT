import Database from 'better-sqlite3'
import type {
  AuditAnomalyRecord,
  AuditChecklistRecord,
  AuditEntryRecord,
  MigrationRecord,
  ReliabilityRepository
} from '../../application/ports/reliability-repository.port'

interface AuditRow {
  id: string
  project_id: string
  status: string
  anomalies_json: string
  checklist_json: string
  created_at: string
}

export function ensureReliabilitySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      anomalies_json TEXT NOT NULL,
      checklist_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_entries_project
      ON audit_entries(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      format_version INTEGER NOT NULL,
      database_schema_version INTEGER NOT NULL,
      app_version TEXT NOT NULL,
      details TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_migrations_project
      ON migrations(project_id, applied_at DESC);
  `)
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

export function createDrizzleReliabilityRepository(
  dbPath: string
): ReliabilityRepository {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureReliabilitySchema(db)

  const saveAuditStmt = db.prepare(`
    INSERT OR REPLACE INTO audit_entries (
      id, project_id, status, anomalies_json, checklist_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)
  const listAuditsStmt = db.prepare(`
    SELECT * FROM audit_entries
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const saveMigrationStmt = db.prepare(`
    INSERT OR REPLACE INTO migrations (
      id, project_id, format_version, database_schema_version,
      app_version, details, applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const hasMigrationStmt = db.prepare('SELECT id FROM migrations WHERE id = ? LIMIT 1')

  return {
    async saveAudit(entry): Promise<void> {
      saveAuditStmt.run(
        entry.id,
        entry.projectId,
        entry.status,
        JSON.stringify(entry.anomalies),
        JSON.stringify(entry.checklist),
        entry.createdAt
      )
    },

    async listAudits(projectId, limit = 20): Promise<AuditEntryRecord[]> {
      const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
      const rows = listAuditsStmt.all(projectId, safeLimit) as AuditRow[]
      return rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        status: row.status as AuditEntryRecord['status'],
        anomalies: parseJsonArray<AuditAnomalyRecord>(row.anomalies_json, []),
        checklist: parseJsonArray<AuditChecklistRecord>(row.checklist_json, []),
        createdAt: row.created_at
      }))
    },

    async saveMigration(entry: MigrationRecord): Promise<void> {
      saveMigrationStmt.run(
        entry.id,
        entry.projectId,
        entry.formatVersion,
        entry.databaseSchemaVersion,
        entry.appVersion,
        entry.details,
        entry.appliedAt
      )
    },

    async hasMigration(id: string): Promise<boolean> {
      return Boolean(hasMigrationStmt.get(id))
    },

    close(): void {
      db.close()
    }
  }
}
