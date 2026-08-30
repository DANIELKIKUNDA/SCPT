import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export interface FinalExportAttemptPaths {
  attemptDir: string
  temporaryOutput: string
  finalRelativePath: string
  finalAbsolutePath: string
  finalFileName: string
  logRelativePath: string
  logAbsolutePath: string
}

function assertInsideProject(projectDir: string, candidate: string): string {
  const root = resolve(projectDir)
  const absolute = resolve(candidate)
  const rel = relative(root, absolute)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('FINAL_EXPORT_PATH_ESCAPE')
  return absolute
}

function posixRelative(projectDir: string, absolutePath: string): string {
  const rel = relative(resolve(projectDir), resolve(absolutePath)).replace(/\\/g, '/')
  if (!rel || rel.startsWith('../') || rel === '..') throw new Error('FINAL_EXPORT_PATH_ESCAPE')
  return rel
}

export function sanitizeExportFileStem(value: string): string {
  const withoutControlCharacters = [...value.normalize('NFKC')]
    .map((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && codePoint < 0x20 ? ' ' : character
    })
    .join('')

  const normalized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return (normalized || 'SCPT').slice(0, 90).replace(/\s+/g, '_')
}

export class FinalExportFilesystem {
  constructor(
    private readonly projectDir: string,
    private readonly freeBytesProvider?: (directory: string) => Promise<number>
  ) {}

  absoluteFromRelative(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/')
    if (
      !normalized || relativePath.includes('\\') || normalized.startsWith('/') ||
      /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')
    ) {
      throw new Error('FINAL_EXPORT_INVALID_RELATIVE_PATH')
    }
    return assertInsideProject(this.projectDir, join(this.projectDir, normalized))
  }

  async prepareAttempt(input: {
    exportId: string
    attempt: number
    projectTitle: string
    formatLabel: string
  }): Promise<FinalExportAttemptPaths> {
    const safeId = input.exportId.replace(/[^A-Za-z0-9_-]/g, '_')
    const safeFormat = input.formatLabel.replace(/[^A-Za-z0-9_-]/g, '_').toLowerCase()
    const safeTitle = sanitizeExportFileStem(input.projectTitle)
    const suffix = safeId.slice(-8)
    const finalFileName = `${safeTitle}_${safeFormat}_${suffix}.mp4`
    const attemptDir = assertInsideProject(this.projectDir, join(this.projectDir, 'temp', 'exporting', safeId, `attempt-${input.attempt}`))
    const finalAbsolutePath = assertInsideProject(this.projectDir, join(this.projectDir, 'renders', 'final', finalFileName))
    const logAbsolutePath = assertInsideProject(this.projectDir, join(this.projectDir, 'logs', `final-export-${safeId}.jsonl`))
    if (existsSync(finalAbsolutePath)) throw new Error('FINAL_EXPORT_OUTPUT_EXISTS')
    await Promise.all([
      mkdir(attemptDir, { recursive: true }),
      mkdir(dirname(finalAbsolutePath), { recursive: true }),
      mkdir(dirname(logAbsolutePath), { recursive: true })
    ])
    return {
      attemptDir,
      temporaryOutput: join(attemptDir, 'finalizing.mp4'),
      finalRelativePath: posixRelative(this.projectDir, finalAbsolutePath),
      finalAbsolutePath,
      finalFileName,
      logRelativePath: posixRelative(this.projectDir, logAbsolutePath),
      logAbsolutePath
    }
  }

  async assertSufficientDiskSpace(input: { sourceVideo: string; sourceAudio: string; destinationDir: string }): Promise<void> {
    const [video, audio] = await Promise.all([stat(input.sourceVideo), stat(input.sourceAudio)])
    const required = Math.ceil((video.size + audio.size) * 2.25 + 64 * 1024 * 1024)
    const available = this.freeBytesProvider
      ? await this.freeBytesProvider(input.destinationDir)
      : await this.availableBytes(input.destinationDir)
    if (available < required) throw new Error('FINAL_EXPORT_DISK_SPACE_INSUFFICIENT')
  }

  async verifyChecksum(filePath: string, expected: string): Promise<void> {
    if (!existsSync(filePath)) throw new Error('FINAL_EXPORT_INPUT_MISSING')
    const actual = await this.sha256(filePath)
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('FINAL_EXPORT_SOURCE_CHECKSUM_MISMATCH')
  }

  async commitVerifiedOutput(paths: FinalExportAttemptPaths): Promise<{ checksum: string; sizeBytes: number }> {
    const info = await stat(paths.temporaryOutput)
    if (!info.isFile() || info.size <= 0) throw new Error('FINAL_EXPORT_OUTPUT_EMPTY')
    if (existsSync(paths.finalAbsolutePath)) throw new Error('FINAL_EXPORT_OUTPUT_EXISTS')
    await rename(paths.temporaryOutput, paths.finalAbsolutePath)
    const finalInfo = await stat(paths.finalAbsolutePath)
    const checksum = await this.sha256(paths.finalAbsolutePath)
    return { checksum, sizeBytes: finalInfo.size }
  }

  async cleanupAttempt(paths: FinalExportAttemptPaths): Promise<void> {
    await rm(paths.attemptDir, { recursive: true, force: true })
  }

  async removeFinal(relativePath: string | null): Promise<void> {
    if (!relativePath) return
    await rm(this.absoluteFromRelative(relativePath), { force: true })
  }

  async appendLog(logAbsolutePath: string, entry: Record<string, unknown>): Promise<void> {
    const target = assertInsideProject(this.projectDir, logAbsolutePath)
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`
    await writeFile(target, line, { encoding: 'utf8', flag: 'a' })
  }

  async readLog(relativePath: string): Promise<string> {
    return readFile(this.absoluteFromRelative(relativePath), 'utf8')
  }

  private async availableBytes(directory: string): Promise<number> {
    const stats = await statfs(directory)
    return Number(stats.bavail) * Number(stats.bsize)
  }

  private async sha256(filePath: string): Promise<string> {
    return new Promise((resolveHash, rejectHash) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)
      stream.on('error', rejectHash)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolveHash(hash.digest('hex')))
    })
  }
}
