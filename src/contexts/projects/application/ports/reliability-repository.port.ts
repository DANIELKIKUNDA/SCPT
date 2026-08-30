export type AuditSeverity = 'info' | 'warning' | 'blocking'
export type AuditStatus = 'healthy' | 'attention' | 'blocked'
export type ChecklistStatus = 'ok' | 'warning' | 'blocked'

export interface AuditAnomalyRecord {
  code: string
  severity: AuditSeverity
  message: string
  detail: string | null
}

export interface AuditChecklistRecord {
  id: string
  label: string
  status: ChecklistStatus
  detail: string
}

export interface AuditEntryRecord {
  id: string
  projectId: string
  status: AuditStatus
  anomalies: AuditAnomalyRecord[]
  checklist: AuditChecklistRecord[]
  createdAt: string
}

export interface MigrationRecord {
  id: string
  projectId: string
  formatVersion: number
  databaseSchemaVersion: number
  appVersion: string
  details: string
  appliedAt: string
}

export interface ReliabilityRepository {
  saveAudit(entry: AuditEntryRecord): Promise<void>
  listAudits(projectId: string, limit?: number): Promise<AuditEntryRecord[]>
  saveMigration(entry: MigrationRecord): Promise<void>
  hasMigration(id: string): Promise<boolean>
  close(): void
}
