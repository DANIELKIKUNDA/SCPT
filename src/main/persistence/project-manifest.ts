import { join } from 'path'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { logger } from '../logging/logger'

/**
 * Per-project physical manifest: project.scpt.json
 *
 * This is a JSON file stored alongside each project's database directory.
 * It IS NOT the Phase 1 user preferences file (stored in electron-store).
 *
 * Structure on disk:
 *   {projectsDir}/{projectId}/
 *   ├── project.scpt.json    ← THIS FILE
 *   └── database/
 *       └── project.sqlite     ← Per-project SQLite database
 */

export interface ProjectManifestData {
  /** Project ULID */
  id: string
  /** Project title */
  titre: string
  /** Project type (e.g. CAPTATION, TUTORIEL) */
  type: string
  /** Creation timestamp (ISO 8601) */
  createdAt: string
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string
  /** SCPT manifest format version */
  formatVersion: number
  /** Relative path to the project database */
  databasePath: string
}

const MANIFEST_FORMAT_VERSION = 1

export class ProjectManifestService {
  private projectsDir: string

  constructor() {
    this.projectsDir = join(app.getPath('userData'), 'projects')
    if (!existsSync(this.projectsDir)) {
      mkdirSync(this.projectsDir, { recursive: true })
    }
  }

  /**
   * Returns the project directory path for a given project ID.
   */
  getProjectDir(projectId: string): string {
    return join(this.projectsDir, projectId)
  }

  /**
   * Returns the manifest file path for a given project ID.
   */
  getManifestPath(projectId: string): string {
    return join(this.getProjectDir(projectId), 'project.scpt.json')
  }

  /**
   * Create the project directory and write the manifest.
   */
  writeManifest(data: ProjectManifestData): void {
    const projectDir = this.getProjectDir(data.id)
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true })
    }

    // Canonical project directories created eagerly so later phases can reopen safely.
    const requiredDirs = [
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
      join(projectDir, 'temp', 'rendering')
    ]
    for (const directory of requiredDirs) {
      if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
    }

    const manifestPath = this.getManifestPath(data.id)
    const manifest = { ...data, formatVersion: MANIFEST_FORMAT_VERSION }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    logger.info({ projectId: data.id, manifestPath }, 'Project manifest written')
  }

  /**
   * Read an existing project manifest.
   * Returns null if the manifest does not exist.
   */
  readManifest(projectId: string): ProjectManifestData | null {
    const manifestPath = this.getManifestPath(projectId)
    if (!existsSync(manifestPath)) {
      return null
    }
    try {
      const raw = readFileSync(manifestPath, 'utf-8')
      return JSON.parse(raw) as ProjectManifestData
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to read project manifest')
      return null
    }
  }

  /**
   * Check if a project manifest exists on disk.
   */
  exists(projectId: string): boolean {
    return existsSync(this.getManifestPath(projectId))
  }

  /**
   * Get the expected database path for a project.
   */
  getDatabasePath(projectId: string): string {
    return join(this.getProjectDir(projectId), 'database', 'project.sqlite')
  }
}

let instance: ProjectManifestService | null = null

export function getProjectManifestService(): ProjectManifestService {
  if (!instance) {
    instance = new ProjectManifestService()
  }
  return instance
}