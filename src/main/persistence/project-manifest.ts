import { join } from 'path'
import { writeFileSync, existsSync, readFileSync, mkdirSync, renameSync, rmSync } from 'fs'
import { app } from 'electron'
import { logger } from '../logging/logger'

/**
 * Per-project physical manifest: project.scpt.json
 *
 * Phase 11 makes this file the small recovery/version envelope described by
 * the canonical implementation docs. Structured project data remains in
 * SQLite; the manifest deliberately does not duplicate it.
 */
export interface ProjectRecoveryOptions {
  lastCleanCloseAt: string | null
  lastAuditAt: string | null
  lastSnapshotAt: string | null
  lastRestoreAt: string | null
}

export interface ProjectManifestData {
  id: string
  titre: string
  type: string
  createdAt: string
  updatedAt: string
  formatVersion: number
  databasePath: string
  databaseSchemaVersion: number
  createdWithAppVersion: string
  lastOpenedWithAppVersion: string
  lastOpenedAt: string | null
  recovery: ProjectRecoveryOptions
}

export const MANIFEST_FORMAT_VERSION = 2
export const DATABASE_SCHEMA_VERSION = 1

const DEFAULT_RECOVERY: ProjectRecoveryOptions = {
  lastCleanCloseAt: null,
  lastAuditAt: null,
  lastSnapshotAt: null,
  lastRestoreAt: null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseManifest(raw: unknown): ProjectManifestData {
  if (!isRecord(raw)) throw new Error('PROJECT_MANIFEST_INVALID')
  const requiredStrings = ['id', 'titre', 'type', 'createdAt', 'updatedAt', 'databasePath'] as const
  for (const key of requiredStrings) {
    if (typeof raw[key] !== 'string' || raw[key].length === 0) throw new Error('PROJECT_MANIFEST_INVALID')
  }
  if (typeof raw.formatVersion !== 'number' || !Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) {
    throw new Error('PROJECT_MANIFEST_INVALID')
  }
  if (raw.formatVersion > MANIFEST_FORMAT_VERSION) throw new Error('PROJECT_FORMAT_NEWER_THAN_APP')

  const recoveryRaw = isRecord(raw.recovery) ? raw.recovery : {}
  const optionalDate = (value: unknown): string | null => typeof value === 'string' ? value : null
  return {
    id: raw.id as string,
    titre: raw.titre as string,
    type: raw.type as string,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
    formatVersion: raw.formatVersion,
    databasePath: raw.databasePath as string,
    databaseSchemaVersion: typeof raw.databaseSchemaVersion === 'number' && Number.isInteger(raw.databaseSchemaVersion)
      ? raw.databaseSchemaVersion
      : 0,
    createdWithAppVersion: typeof raw.createdWithAppVersion === 'string' ? raw.createdWithAppVersion : 'legacy',
    lastOpenedWithAppVersion: typeof raw.lastOpenedWithAppVersion === 'string' ? raw.lastOpenedWithAppVersion : 'legacy',
    lastOpenedAt: optionalDate(raw.lastOpenedAt),
    recovery: {
      lastCleanCloseAt: optionalDate(recoveryRaw.lastCleanCloseAt),
      lastAuditAt: optionalDate(recoveryRaw.lastAuditAt),
      lastSnapshotAt: optionalDate(recoveryRaw.lastSnapshotAt),
      lastRestoreAt: optionalDate(recoveryRaw.lastRestoreAt)
    }
  }
}

export class ProjectManifestService {
  private readonly projectsDir: string

  constructor(projectsDir?: string) {
    this.projectsDir = projectsDir ?? join(app.getPath('userData'), 'projects')
    if (!existsSync(this.projectsDir)) mkdirSync(this.projectsDir, { recursive: true })
  }

  getProjectDir(projectId: string): string {
    return join(this.projectsDir, projectId)
  }

  getManifestPath(projectId: string): string {
    return join(this.getProjectDir(projectId), 'project.scpt.json')
  }

  ensureProjectDirectories(projectId: string): void {
    const projectDir = this.getProjectDir(projectId)
    const requiredDirs = [
      projectDir,
      join(projectDir, 'database'),
      join(projectDir, 'media', 'source'),
      join(projectDir, 'media', 'thumbnails'),
      join(projectDir, 'media', 'derived'),
      join(projectDir, 'audio', 'narration'),
      join(projectDir, 'audio', 'music'),
      join(projectDir, 'audio', 'temp'),
      join(projectDir, 'subtitles'),
      join(projectDir, 'renders', 'previews'),
      join(projectDir, 'renders', 'final'),
      join(projectDir, 'renders', 'failed'),
      join(projectDir, 'logs'),
      join(projectDir, 'backups'),
      join(projectDir, 'recovery'),
      join(projectDir, 'temp', 'rendering'),
      join(projectDir, 'temp', 'exporting'),
      join(projectDir, 'temp', 'restoring')
    ]
    for (const directory of requiredDirs) if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
  }

  writeManifest(data: ProjectManifestData): void {
    this.ensureProjectDirectories(data.id)
    const manifestPath = this.getManifestPath(data.id)
    const tempPath = `${manifestPath}.tmp`
    const manifest: ProjectManifestData = {
      ...data,
      recovery: { ...DEFAULT_RECOVERY, ...data.recovery }
    }
    writeFileSync(tempPath, JSON.stringify(manifest, null, 2), 'utf-8')
    try {
      renameSync(tempPath, manifestPath)
    } catch (error) {
      rmSync(tempPath, { force: true })
      throw error
    }
    logger.info({ projectId: data.id, manifestPath, formatVersion: data.formatVersion }, 'Project manifest written')
  }

  createCurrent(input: {
    id: string
    titre: string
    type: string
    createdAt: string
    updatedAt: string
    appVersion: string
  }): ProjectManifestData {
    const manifest: ProjectManifestData = {
      ...input,
      formatVersion: MANIFEST_FORMAT_VERSION,
      databasePath: 'database/project.sqlite',
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      createdWithAppVersion: input.appVersion,
      lastOpenedWithAppVersion: input.appVersion,
      lastOpenedAt: null,
      recovery: { ...DEFAULT_RECOVERY }
    }
    this.writeManifest(manifest)
    return manifest
  }

  readManifestStrict(projectId: string): ProjectManifestData {
    const manifestPath = this.getManifestPath(projectId)
    if (!existsSync(manifestPath)) throw new Error('PROJECT_MANIFEST_MISSING')
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown
    const parsed = parseManifest(raw)
    if (parsed.id !== projectId) throw new Error('PROJECT_MANIFEST_ID_MISMATCH')
    return parsed
  }

  readManifest(projectId: string): ProjectManifestData | null {
    try {
      return this.readManifestStrict(projectId)
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to read project manifest')
      return null
    }
  }

  patchManifest(projectId: string, patch: Partial<Omit<ProjectManifestData, 'id' | 'recovery'>> & {
    recovery?: Partial<ProjectRecoveryOptions>
  }): ProjectManifestData {
    const current = this.readManifestStrict(projectId)
    const updated: ProjectManifestData = {
      ...current,
      ...patch,
      id: current.id,
      recovery: { ...current.recovery, ...(patch.recovery ?? {}) }
    }
    this.writeManifest(updated)
    return updated
  }

  exists(projectId: string): boolean {
    return existsSync(this.getManifestPath(projectId))
  }

  getDatabasePath(projectId: string): string {
    return join(this.getProjectDir(projectId), 'database', 'project.sqlite')
  }
}

let instance: ProjectManifestService | null = null

export function getProjectManifestService(): ProjectManifestService {
  if (!instance) instance = new ProjectManifestService()
  return instance
}
