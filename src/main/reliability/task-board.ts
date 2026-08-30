import Database from 'better-sqlite3'

export type ReliabilityTaskKind = 'render' | 'final_export'

export interface ReliabilityTaskRecord {
  id: string
  kind: ReliabilityTaskKind
  projectId: string
  targetId: string
  status: string
  progress: number
  attempt: number
  diagnostic: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  active: boolean
  obsolete: boolean
}

const RENDER_ACTIVE = new Set(['demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification'])
const FINAL_ACTIVE = new Set(['demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification'])

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
}

function sourceVersion(db: Database.Database): number {
  if (!tableExists(db, 'project_source_state')) return 1
  const row = db.prepare('SELECT version FROM project_source_state LIMIT 1').get() as { version?: number } | undefined
  return typeof row?.version === 'number' ? row.version : 1
}

export class ProjectTaskBoard {
  constructor(private readonly dbPath: string) {}

  list(projectId: string, limit = 100): ReliabilityTaskRecord[] {
    const db = new Database(this.dbPath, { readonly: true, fileMustExist: true })
    try {
      const currentVersion = sourceVersion(db)
      const tasks: ReliabilityTaskRecord[] = []
      if (tableExists(db, 'render_jobs')) {
        const rows = db.prepare(`
          SELECT id, project_id, declinaison_id, tentative, statut, progression,
                 diagnostic, version_project_source, created_at, updated_at, finished_at
          FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?
        `).all(projectId, limit) as Array<Record<string, unknown>>
        for (const row of rows) {
          const status = String(row.statut)
          tasks.push({
            id: String(row.id),
            kind: 'render',
            projectId: String(row.project_id),
            targetId: String(row.declinaison_id),
            status,
            progress: Number(row.progression),
            attempt: Number(row.tentative),
            diagnostic: row.diagnostic === null ? null : String(row.diagnostic),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
            finishedAt: row.finished_at === null ? null : String(row.finished_at),
            active: RENDER_ACTIVE.has(status),
            obsolete: Number(row.version_project_source) < currentVersion
          })
        }
      }
      if (tableExists(db, 'final_exports')) {
        const rows = db.prepare(`
          SELECT f.id, f.project_id, f.render_job_id, f.tentative, f.statut,
                 f.progression, f.diagnostic, f.created_at, f.updated_at, f.finished_at,
                 r.version_project_source
          FROM final_exports f
          LEFT JOIN render_jobs r ON r.id = f.render_job_id
          WHERE f.project_id = ? ORDER BY f.created_at DESC LIMIT ?
        `).all(projectId, limit) as Array<Record<string, unknown>>
        for (const row of rows) {
          const status = String(row.statut)
          tasks.push({
            id: String(row.id),
            kind: 'final_export',
            projectId: String(row.project_id),
            targetId: String(row.render_job_id),
            status,
            progress: Number(row.progression),
            attempt: Number(row.tentative),
            diagnostic: row.diagnostic === null ? null : String(row.diagnostic),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
            finishedAt: row.finished_at === null ? null : String(row.finished_at),
            active: FINAL_ACTIVE.has(status),
            obsolete: typeof row.version_project_source === 'number' && Number(row.version_project_source) < currentVersion
          })
        }
      }
      return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    } finally {
      db.close()
    }
  }
}
