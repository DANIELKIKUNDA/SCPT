import Database from 'better-sqlite3'
import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AuditEntryRecord } from '../../contexts/projects/application/ports/reliability-repository.port'
import { createDrizzleReliabilityRepository, ensureReliabilitySchema } from '../../contexts/projects/infrastructure/persistence/drizzle-reliability-repository'
import {
  DATABASE_SCHEMA_VERSION,
  MANIFEST_FORMAT_VERSION,
  type ProjectManifestData,
  type ProjectManifestService
} from '../persistence/project-manifest'
import { ProjectAuditService } from './project-audit'
import { ProjectBackupService, type BackupKind, type BackupSummary, sha256File } from './project-backup'
import { RecoverySessionService } from './recovery-session'
import { ProjectTaskBoard, type ReliabilityTaskRecord } from './task-board'
import { ProjectTempCleaner, type TempCleanupResult } from './temp-cleaner'

const PHASE11_MIGRATION_ID = 'phase11-reliability-v1'
const AUTO_SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000

export interface ReliabilityOverview {
  audit: AuditEntryRecord
  backups: BackupSummary[]
  tasks: ReliabilityTaskRecord[]
  recentAudits: AuditEntryRecord[]
  crashRecovered: boolean
  versions: {
    formatVersion: number
    databaseSchemaVersion: number
    appVersion: string
  }
}

export class ProjectReliabilityManager {
  private readonly crashState = new Map<string, boolean>()

  constructor(
    private readonly manifests: ProjectManifestService,
    private readonly appVersion: () => string
  ) {}

  async initializeNewProject(input: {
    id: string
    titre: string
    type: string
    createdAt: string
    updatedAt: string
  }): Promise<void> {
    this.manifests.createCurrent({ ...input, appVersion: this.appVersion() })
    await this.ensureDatabaseSchema(input.id, 'Initialisation Phase 11')
  }

  async prepareOpen(input: {
    id: string
    titre: string
    type: string
    createdAt: string
    updatedAt: string
  }): Promise<ReliabilityOverview> {
    this.manifests.ensureProjectDirectories(input.id)
    if (!this.manifests.exists(input.id)) {
      // Legacy Phase 0–10 projects did not always materialize their small
      // physical manifest at creation time. Bootstrap them as format v1 so the
      // normal migration path (including mandatory backup) remains auditable.
      this.manifests.writeManifest({
        id: input.id,
        titre: input.titre,
        type: input.type,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        formatVersion: 1,
        databasePath: 'database/project.sqlite',
        databaseSchemaVersion: 0,
        createdWithAppVersion: 'legacy',
        lastOpenedWithAppVersion: 'legacy',
        lastOpenedAt: null,
        recovery: {
          lastCleanCloseAt: null,
          lastAuditAt: null,
          lastSnapshotAt: null,
          lastRestoreAt: null
        }
      })
    }

    let manifest = this.manifests.readManifestStrict(input.id)
    const backupService = new ProjectBackupService(this.manifests.getProjectDir(input.id))
    await backupService.removeInvalidBuildingDirectories()

    if (manifest.formatVersion < MANIFEST_FORMAT_VERSION || manifest.databaseSchemaVersion < DATABASE_SCHEMA_VERSION) {
      await backupService.create({
        projectId: input.id,
        kind: 'migration',
        appVersion: this.appVersion(),
        projectFormatVersion: manifest.formatVersion,
        databaseSchemaVersion: manifest.databaseSchemaVersion
      })
      await this.ensureDatabaseSchema(input.id, `Migration vers format ${MANIFEST_FORMAT_VERSION} / schéma ${DATABASE_SCHEMA_VERSION}`)
      manifest = this.manifests.patchManifest(input.id, {
        formatVersion: MANIFEST_FORMAT_VERSION,
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        lastOpenedWithAppVersion: this.appVersion(),
        lastOpenedAt: new Date().toISOString(),
        updatedAt: input.updatedAt
      })
    } else {
      await this.ensureDatabaseSchema(input.id, 'Vérification du schéma Phase 11')
      manifest = this.manifests.patchManifest(input.id, {
        lastOpenedWithAppVersion: this.appVersion(),
        lastOpenedAt: new Date().toISOString(),
        updatedAt: input.updatedAt
      })
    }

    const session = new RecoverySessionService(this.manifests.getProjectDir(input.id))
    const crashDetected = await session.detectPreviousCrash(input.id)
    this.crashState.set(input.id, crashDetected)
    if (crashDetected) await new ProjectTempCleaner(this.manifests.getProjectDir(input.id)).cleanup()
    await session.markOpen(input.id)

    const audit = await this.runAudit(input.id, manifest, crashDetected)
    this.manifests.patchManifest(input.id, {
      recovery: { lastAuditAt: audit.createdAt }
    })
    return this.overviewFromAudit(input.id, audit)
  }

  async getOverview(projectId: string): Promise<ReliabilityOverview> {
    const manifest = this.manifests.readManifestStrict(projectId)
    const audit = await this.runAudit(projectId, manifest, this.crashState.get(projectId) ?? false)
    this.manifests.patchManifest(projectId, { recovery: { lastAuditAt: audit.createdAt } })
    return this.overviewFromAudit(projectId, audit)
  }

  async createManualSnapshot(projectId: string): Promise<BackupSummary> {
    return this.createSnapshot(projectId, 'manual')
  }

  async maybeCreateAutomaticSnapshot(projectId: string, now = Date.now()): Promise<BackupSummary | null> {
    const service = new ProjectBackupService(this.manifests.getProjectDir(projectId))
    const backups = await service.list()
    const latestAuto = backups.find((item) => item.kind === 'automatic' || item.kind === 'close')
    if (latestAuto && now - Date.parse(latestAuto.createdAt) < AUTO_SNAPSHOT_INTERVAL_MS) return null
    const fingerprint = await service.currentSourceFingerprint()
    if (latestAuto?.sourceFingerprint === fingerprint) return null
    return this.createSnapshot(projectId, 'automatic')
  }

  async snapshotOnCleanClose(projectId: string): Promise<BackupSummary | null> {
    const service = new ProjectBackupService(this.manifests.getProjectDir(projectId))
    const latest = await service.getLatest()
    const fingerprint = await service.currentSourceFingerprint()
    let snapshot: BackupSummary | null = null
    if (!latest || latest.sourceFingerprint !== fingerprint) snapshot = await this.createSnapshot(projectId, 'close')
    await new RecoverySessionService(this.manifests.getProjectDir(projectId)).markCleanClose()
    this.crashState.delete(projectId)
    this.manifests.patchManifest(projectId, {
      recovery: { lastCleanCloseAt: new Date().toISOString() }
    })
    return snapshot
  }

  async listBackups(projectId: string): Promise<BackupSummary[]> {
    return new ProjectBackupService(this.manifests.getProjectDir(projectId)).list()
  }

  async cleanupTemporaryFiles(projectId: string): Promise<TempCleanupResult> {
    const tasks = new ProjectTaskBoard(this.manifests.getDatabasePath(projectId)).list(projectId)
    const activeNames = new Set(tasks.filter((item) => item.active).map((item) => item.id))
    return new ProjectTempCleaner(this.manifests.getProjectDir(projectId)).cleanup({ activeNames })
  }

  listTasks(projectId: string): ReliabilityTaskRecord[] {
    return new ProjectTaskBoard(this.manifests.getDatabasePath(projectId)).list(projectId)
  }

  async restoreBackup(projectId: string, backupId: string): Promise<{
    restored: true
    backupId: string
    safetyBackupId: string
    requiresReopen: true
  }> {
    const projectDir = this.manifests.getProjectDir(projectId)
    const service = new ProjectBackupService(projectDir)
    const targetManifest = await service.validate(backupId, projectId)
    const current = this.manifests.readManifestStrict(projectId)
    const safety = await service.create({
      projectId,
      kind: 'pre_restore',
      appVersion: this.appVersion(),
      projectFormatVersion: current.formatVersion,
      databaseSchemaVersion: current.databaseSchemaVersion
    })

    const restoreId = `restore-${Date.now()}`
    const stageDir = join(projectDir, 'temp', 'restoring', restoreId)
    const snapshotDir = service.getSnapshotDir(backupId)
    const stageDb = join(stageDir, 'project.sqlite')
    const liveDb = this.manifests.getDatabasePath(projectId)
    const liveDbTemp = `${liveDb}.restore-tmp`
    const rollbackDb = `${liveDb}.rollback-${Date.now()}`
    await rm(stageDir, { recursive: true, force: true })
    await mkdir(stageDir, { recursive: true })

    const restoredMissingFiles: string[] = []
    let hadLiveDb = false
    let dbSwapStarted = false
    let restoreCommitted = false
    try {
      await copyFile(join(snapshotDir, 'database', 'project.sqlite'), stageDb)
      this.assertDatabaseIntegrity(stageDb)

      // First validate every existing source/immutable file. This is a strict
      // preflight: no project file is touched until all conflicts are known.
      const restorable = targetManifest.files.filter((file) =>
        file.path !== 'database/project.sqlite' && file.path !== 'project.scpt.json'
      )
      for (const file of restorable) {
        const destination = join(projectDir, ...file.path.split('/'))
        if (existsSync(destination) && await sha256File(destination) !== file.sha256) {
          throw new Error(`RESTORE_IMMUTABLE_CONFLICT:${file.path}`)
        }
      }

      // Only missing files are restored; existing immutable/source files are
      // never overwritten. Created files are tracked so a later DB-swap error
      // can roll the filesystem back to its exact pre-restore state.
      for (const file of restorable) {
        const source = join(snapshotDir, ...file.path.split('/'))
        const destination = join(projectDir, ...file.path.split('/'))
        if (existsSync(destination)) continue
        await mkdir(dirname(destination), { recursive: true })
        await copyFile(source, destination)
        restoredMissingFiles.push(destination)
      }

      await rm(`${liveDb}-wal`, { force: true })
      await rm(`${liveDb}-shm`, { force: true })
      await rm(liveDbTemp, { force: true })
      await copyFile(stageDb, liveDbTemp)

      hadLiveDb = existsSync(liveDb)
      if (hadLiveDb) await rename(liveDb, rollbackDb)
      dbSwapStarted = true
      await rename(liveDbTemp, liveDb)
      this.assertDatabaseIntegrity(liveDb)
      await this.ensureDatabaseSchema(projectId, `Restauration du snapshot ${backupId}`)

      await new RecoverySessionService(projectDir).markCleanClose()
      this.crashState.delete(projectId)
      this.manifests.patchManifest(projectId, {
        formatVersion: MANIFEST_FORMAT_VERSION,
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        lastOpenedWithAppVersion: this.appVersion(),
        recovery: { lastRestoreAt: new Date().toISOString() }
      })
      restoreCommitted = true
      if (hadLiveDb) await rm(rollbackDb, { force: true }).catch(() => undefined)

      return { restored: true, backupId, safetyBackupId: safety.id, requiresReopen: true }
    } catch (error) {
      // If the database swap started but any validation/schema/metadata step
      // failed, restore the exact pre-restore database before returning the
      // error. The pre_restore snapshot remains as an additional safety net.
      if (!restoreCommitted && dbSwapStarted && hadLiveDb && existsSync(rollbackDb)) {
        await rm(`${liveDb}-wal`, { force: true }).catch(() => undefined)
        await rm(`${liveDb}-shm`, { force: true }).catch(() => undefined)
        await rm(liveDb, { force: true }).catch(() => undefined)
        await rename(rollbackDb, liveDb)
      }
      for (const created of restoredMissingFiles.reverse()) await rm(created, { force: true })
      throw error
    } finally {
      await rm(stageDir, { recursive: true, force: true })
      await rm(liveDbTemp, { force: true })
    }
  }

  private async createSnapshot(projectId: string, kind: BackupKind): Promise<BackupSummary> {
    const manifest = this.manifests.readManifestStrict(projectId)
    const result = await new ProjectBackupService(this.manifests.getProjectDir(projectId)).create({
      projectId,
      kind,
      appVersion: this.appVersion(),
      projectFormatVersion: manifest.formatVersion,
      databaseSchemaVersion: manifest.databaseSchemaVersion
    })
    this.manifests.patchManifest(projectId, { recovery: { lastSnapshotAt: result.createdAt } })
    return result
  }

  private async runAudit(projectId: string, manifest: ProjectManifestData, crashDetected: boolean): Promise<AuditEntryRecord> {
    const repo = createDrizzleReliabilityRepository(this.manifests.getDatabasePath(projectId))
    try {
      return await new ProjectAuditService(this.manifests.getProjectDir(projectId), repo).run({
        projectId,
        manifest,
        crashDetected
      })
    } finally {
      repo.close()
    }
  }

  private async overviewFromAudit(projectId: string, audit: AuditEntryRecord): Promise<ReliabilityOverview> {
    const repo = createDrizzleReliabilityRepository(this.manifests.getDatabasePath(projectId))
    try {
      const manifest = this.manifests.readManifestStrict(projectId)
      return {
        audit,
        backups: await this.listBackups(projectId),
        tasks: this.listTasks(projectId),
        recentAudits: await repo.listAudits(projectId, 10),
        crashRecovered: this.crashState.get(projectId) ?? false,
        versions: {
          formatVersion: manifest.formatVersion,
          databaseSchemaVersion: manifest.databaseSchemaVersion,
          appVersion: this.appVersion()
        }
      }
    } finally {
      repo.close()
    }
  }

  private async ensureDatabaseSchema(projectId: string, details: string): Promise<void> {
    const dbPath = this.manifests.getDatabasePath(projectId)
    const db = new Database(dbPath)
    try {
      db.pragma('journal_mode = WAL')
      ensureReliabilitySchema(db)
    } finally {
      db.close()
    }
    const repo = createDrizzleReliabilityRepository(dbPath)
    try {
      if (!await repo.hasMigration(PHASE11_MIGRATION_ID)) {
        await repo.saveMigration({
          id: PHASE11_MIGRATION_ID,
          projectId,
          formatVersion: MANIFEST_FORMAT_VERSION,
          databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
          appVersion: this.appVersion(),
          details,
          appliedAt: new Date().toISOString()
        })
      }
    } finally {
      repo.close()
    }
  }

  private assertDatabaseIntegrity(dbPath: string): void {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const integrity = db.pragma('integrity_check', { simple: true }) as string
      if (integrity !== 'ok') throw new Error('RESTORE_DATABASE_INTEGRITY_FAILED')
    } finally {
      db.close()
    }
  }
}

