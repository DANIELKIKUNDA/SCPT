import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  lstat,
  writeFile
} from 'node:fs/promises'
import { createReadStream, existsSync, type Dirent } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { computeProjectSourceFingerprint } from '../../contexts/projects/infrastructure/persistence/project-source-snapshot'

export type BackupKind = 'automatic' | 'manual' | 'close' | 'migration' | 'pre_restore'

export interface BackupFileRecord {
  path: string
  size: number
  sha256: string
}

export interface ProjectBackupManifest {
  backupFormatVersion: 1
  backupId: string
  projectId: string
  kind: BackupKind
  createdAt: string
  appVersion: string
  projectFormatVersion: number
  databaseSchemaVersion: number
  sourceFingerprint: string
  files: BackupFileRecord[]
}

export interface BackupSummary {
  id: string
  kind: BackupKind
  createdAt: string
  appVersion: string
  projectFormatVersion: number
  databaseSchemaVersion: number
  fileCount: number
  totalBytes: number
  sourceFingerprint: string
}

const SNAPSHOT_ROOTS = [
  'media/source',
  'audio/narration',
  'audio/music',
  'subtitles',
  'renders/previews',
  'renders/final'
] as const
const BACKUP_MANIFEST = 'backup.manifest.json'
const SNAPSHOT_DIR = 'snapshot'

function toPosix(value: string): string {
  return value.split(sep).join('/')
}

function assertContained(root: string, target: string): void {
  const rootResolved = resolve(root)
  const targetResolved = resolve(target)
  const rel = relative(rootResolved, targetResolved)
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) throw new Error('BACKUP_PATH_ESCAPE')
}

export async function sha256File(filePath: string): Promise<string> {
  return await new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(current, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw error
  }

  const result: string[] = []
  for (const entry of entries) {
    const full = join(current, entry.name)
    const info = await lstat(full)
    if (info.isSymbolicLink()) throw new Error('BACKUP_SYMLINK_NOT_ALLOWED')
    if (entry.isDirectory()) result.push(...await walkFiles(root, full))
    else if (entry.isFile()) result.push(full)
  }
  return result
}

async function copyTree(sourceRoot: string, destinationRoot: string): Promise<void> {
  const files = await walkFiles(sourceRoot)
  for (const source of files) {
    const rel = relative(sourceRoot, source)
    const destination = join(destinationRoot, rel)
    assertContained(destinationRoot, destination)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
  }
}

async function collectManifestFiles(snapshotDir: string): Promise<BackupFileRecord[]> {
  const files = await walkFiles(snapshotDir)
  const records: BackupFileRecord[] = []
  for (const file of files) {
    const info = await stat(file)
    records.push({
      path: toPosix(relative(snapshotDir, file)),
      size: info.size,
      sha256: await sha256File(file)
    })
  }
  return records.sort((a, b) => a.path.localeCompare(b.path))
}

async function metadataFingerprint(projectDir: string): Promise<string> {
  // Snapshot cadence must follow meaningful project changes, not Phase 11's
  // own audit/recovery timestamps. The canonical source fingerprint excludes
  // operational tables and timestamps; output directories capture successful
  // Phase 9/10 products that are not part of authored source state.
  const rows: string[] = []
  const dbPath = join(projectDir, 'database', 'project.sqlite')
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      rows.push(`source:${computeProjectSourceFingerprint(db)}`)
    } finally {
      db.close()
    }
  } else {
    rows.push('source:missing-database')
  }

  const outputRoots = [join(projectDir, 'renders', 'previews'), join(projectDir, 'renders', 'final')]
  for (const root of outputRoots) {
    const files = await walkFiles(root)
    for (const file of files) {
      const info = await stat(file)
      rows.push(`${toPosix(relative(projectDir, file))}:${info.size}:${Math.trunc(info.mtimeMs)}`)
    }
  }
  return createHash('sha256').update(rows.sort().join('\n')).digest('hex')
}

function parseBackupManifest(raw: unknown): ProjectBackupManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('BACKUP_MANIFEST_INVALID')
  const value = raw as Partial<ProjectBackupManifest>
  if (
    value.backupFormatVersion !== 1 ||
    typeof value.backupId !== 'string' ||
    typeof value.projectId !== 'string' ||
    !['automatic', 'manual', 'close', 'migration', 'pre_restore'].includes(value.kind ?? '') ||
    typeof value.createdAt !== 'string' ||
    typeof value.appVersion !== 'string' ||
    typeof value.projectFormatVersion !== 'number' ||
    typeof value.databaseSchemaVersion !== 'number' ||
    typeof value.sourceFingerprint !== 'string' ||
    !Array.isArray(value.files) ||
    !value.files.every((file) =>
      file && typeof file === 'object' &&
      typeof (file as BackupFileRecord).path === 'string' &&
      typeof (file as BackupFileRecord).size === 'number' &&
      Number.isFinite((file as BackupFileRecord).size) &&
      typeof (file as BackupFileRecord).sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test((file as BackupFileRecord).sha256)
    )
  ) throw new Error('BACKUP_MANIFEST_INVALID')
  return value as ProjectBackupManifest
}

export class ProjectBackupService {
  constructor(private readonly projectDir: string) {}

  private get backupsDir(): string {
    return join(this.projectDir, 'backups')
  }

  async currentSourceFingerprint(): Promise<string> {
    return metadataFingerprint(this.projectDir)
  }

  async create(input: {
    projectId: string
    kind: BackupKind
    appVersion: string
    projectFormatVersion: number
    databaseSchemaVersion: number
  }): Promise<BackupSummary> {
    await mkdir(this.backupsDir, { recursive: true })
    const backupId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${input.kind}-${randomUUID().slice(0, 8)}`
    const buildingDir = join(this.backupsDir, `.building-${backupId}`)
    const finalDir = join(this.backupsDir, backupId)
    const snapshotDir = join(buildingDir, SNAPSHOT_DIR)
    await rm(buildingDir, { recursive: true, force: true })
    await mkdir(snapshotDir, { recursive: true })

    try {
      const manifestPath = join(this.projectDir, 'project.scpt.json')
      try {
        await mkdir(dirname(join(snapshotDir, 'project.scpt.json')), { recursive: true })
        await copyFile(manifestPath, join(snapshotDir, 'project.scpt.json'))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }

      const liveDbPath = join(this.projectDir, 'database', 'project.sqlite')
      const backupDbPath = join(snapshotDir, 'database', 'project.sqlite')
      await mkdir(dirname(backupDbPath), { recursive: true })
      if (existsSync(liveDbPath)) {
        const db = new Database(liveDbPath, { fileMustExist: true })
        try {
          db.pragma('wal_checkpoint(PASSIVE)')
          await db.backup(backupDbPath)
        } finally {
          db.close()
        }
      } else {
        // A backup must never create/mutate the live database as a side effect.
        const empty = new Database(backupDbPath)
        empty.close()
      }

      // Snapshot only durable project-owned assets. Disposable/derived roots
      // (audio/temp, media/thumbnails, media/derived, renders/failed, logs, temp)
      // are deliberately excluded: restoring them would either resurrect stale
      // work or create checksum conflicts with operational files that naturally
      // change after a snapshot.
      for (const rootName of SNAPSHOT_ROOTS) {
        const parts = rootName.split('/')
        await copyTree(join(this.projectDir, ...parts), join(snapshotDir, ...parts))
      }

      const files = await collectManifestFiles(snapshotDir)
      const sourceFingerprint = await metadataFingerprint(this.projectDir)
      const backupManifest: ProjectBackupManifest = {
        backupFormatVersion: 1,
        backupId,
        projectId: input.projectId,
        kind: input.kind,
        createdAt: new Date().toISOString(),
        appVersion: input.appVersion,
        projectFormatVersion: input.projectFormatVersion,
        databaseSchemaVersion: input.databaseSchemaVersion,
        sourceFingerprint,
        files
      }
      await writeFile(join(buildingDir, BACKUP_MANIFEST), JSON.stringify(backupManifest, null, 2), 'utf-8')
      await rename(buildingDir, finalDir)
      await this.enforceRetention()
      return this.toSummary(backupManifest)
    } catch (error) {
      await rm(buildingDir, { recursive: true, force: true })
      throw error
    }
  }

  async list(): Promise<BackupSummary[]> {
    await mkdir(this.backupsDir, { recursive: true })
    const entries = await readdir(this.backupsDir, { withFileTypes: true })
    const result: BackupSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.building-')) continue
      try {
        const manifest = await this.readManifest(entry.name)
        result.push(this.toSummary(manifest))
      } catch {
        // Corrupted backup directories are reported by the audit service and
        // intentionally not exposed as restorable snapshots.
      }
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async validate(backupId: string, expectedProjectId?: string): Promise<ProjectBackupManifest> {
    const manifest = await this.readManifest(backupId)
    if (expectedProjectId && manifest.projectId !== expectedProjectId) throw new Error('BACKUP_PROJECT_MISMATCH')
    const snapshotDir = join(this.backupsDir, backupId, SNAPSHOT_DIR)
    for (const file of manifest.files) {
      const full = join(snapshotDir, ...file.path.split('/'))
      assertContained(snapshotDir, full)
      const info = await stat(full)
      if (!info.isFile() || info.size !== file.size) throw new Error('BACKUP_FILE_SIZE_MISMATCH')
      if (await sha256File(full) !== file.sha256) throw new Error('BACKUP_FILE_CHECKSUM_MISMATCH')
    }
    const dbPath = join(snapshotDir, 'database', 'project.sqlite')
    const db = new Database(dbPath, { readonly: true })
    try {
      const integrity = db.pragma('integrity_check', { simple: true }) as string
      if (integrity !== 'ok') throw new Error('BACKUP_DATABASE_CORRUPTED')
    } finally {
      db.close()
    }
    return manifest
  }

  getSnapshotDir(backupId: string): string {
    const result = join(this.backupsDir, backupId, SNAPSHOT_DIR)
    assertContained(this.backupsDir, result)
    return result
  }

  async getLatest(): Promise<BackupSummary | null> {
    return (await this.list())[0] ?? null
  }

  async removeInvalidBuildingDirectories(): Promise<number> {
    await mkdir(this.backupsDir, { recursive: true })
    const entries = await readdir(this.backupsDir, { withFileTypes: true })
    let removed = 0
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('.building-')) {
        await rm(join(this.backupsDir, entry.name), { recursive: true, force: true })
        removed++
      }
    }
    return removed
  }

  private async readManifest(backupId: string): Promise<ProjectBackupManifest> {
    if (!backupId || backupId.includes('/') || backupId.includes('\\') || backupId.includes('..')) throw new Error('BACKUP_ID_INVALID')
    const manifestPath = join(this.backupsDir, backupId, BACKUP_MANIFEST)
    assertContained(this.backupsDir, manifestPath)
    return parseBackupManifest(JSON.parse(await readFile(manifestPath, 'utf-8')) as unknown)
  }

  private toSummary(manifest: ProjectBackupManifest): BackupSummary {
    return {
      id: manifest.backupId,
      kind: manifest.kind,
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      projectFormatVersion: manifest.projectFormatVersion,
      databaseSchemaVersion: manifest.databaseSchemaVersion,
      fileCount: manifest.files.length,
      totalBytes: manifest.files.reduce((total, item) => total + item.size, 0),
      sourceFingerprint: manifest.sourceFingerprint
    }
  }

  private async enforceRetention(): Promise<void> {
    const entries = await this.list()
    const autoLike = entries.filter((entry) => entry.kind === 'automatic' || entry.kind === 'close')
    const manual = entries.filter((entry) => entry.kind === 'manual')
    for (const item of autoLike.slice(20)) await rm(join(this.backupsDir, item.id), { recursive: true, force: true })
    for (const item of manual.slice(10)) await rm(join(this.backupsDir, item.id), { recursive: true, force: true })
    // migration and pre_restore backups are never deleted automatically.
  }
}

export function backupBasename(projectDir: string): string {
  return basename(projectDir)
}
