import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export interface RenderAttemptPaths {
  attemptDir: string
  temporaryOutput: string
  finalRelativePath: string
  finalAbsolutePath: string
  logRelativePath: string
  logAbsolutePath: string
}

function assertInsideProject(projectDir: string, candidate: string): string {
  const root = resolve(projectDir)
  const absolute = resolve(candidate)
  const rel = relative(root, absolute)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('RENDER_PATH_ESCAPE')
  return absolute
}

function posixRelative(projectDir: string, absolutePath: string): string {
  const rel = relative(resolve(projectDir), resolve(absolutePath)).replace(/\\/g, '/')
  if (!rel || rel.startsWith('../') || rel === '..') throw new Error('RENDER_PATH_ESCAPE')
  return rel
}

export class RenderFilesystem {
  constructor(private readonly projectDir: string) {}

  async prepareAttempt(input: {
    jobId: string
    attempt: number
    formatLabel: string
  }): Promise<RenderAttemptPaths> {
    const safeJobId = input.jobId.replace(/[^A-Za-z0-9_-]/g, '_')
    const safeFormat = input.formatLabel.replace(/[^A-Za-z0-9_-]/g, '_').toLowerCase()
    const attemptDir = assertInsideProject(
      this.projectDir,
      join(this.projectDir, 'temp', 'rendering', safeJobId, `attempt-${input.attempt}`)
    )
    const finalAbsolutePath = assertInsideProject(
      this.projectDir,
      join(this.projectDir, 'renders', 'previews', `${safeFormat}-${safeJobId}-a${input.attempt}.mp4`)
    )
    const logAbsolutePath = assertInsideProject(
      this.projectDir,
      join(this.projectDir, 'logs', `render-${safeJobId}.jsonl`)
    )

    await mkdir(attemptDir, { recursive: true })
    await mkdir(dirname(finalAbsolutePath), { recursive: true })
    await mkdir(dirname(logAbsolutePath), { recursive: true })

    return {
      attemptDir,
      temporaryOutput: join(attemptDir, 'intermediate.mp4'),
      finalRelativePath: posixRelative(this.projectDir, finalAbsolutePath),
      finalAbsolutePath,
      logRelativePath: posixRelative(this.projectDir, logAbsolutePath),
      logAbsolutePath
    }
  }

  async commitTemporaryOutput(paths: RenderAttemptPaths): Promise<{ checksum: string; sizeBytes: number }> {
    const info = await stat(paths.temporaryOutput)
    if (!info.isFile() || info.size <= 0) throw new Error('RENDER_OUTPUT_EMPTY')
    if (existsSync(paths.finalAbsolutePath)) throw new Error('RENDER_OUTPUT_ALREADY_EXISTS')
    await mkdir(dirname(paths.finalAbsolutePath), { recursive: true })
    await rename(paths.temporaryOutput, paths.finalAbsolutePath)
    const checksum = await this.sha256(paths.finalAbsolutePath)
    const finalInfo = await stat(paths.finalAbsolutePath)
    return { checksum, sizeBytes: finalInfo.size }
  }

  async appendLog(logAbsolutePath: string, entry: Record<string, unknown>): Promise<void> {
    const target = assertInsideProject(this.projectDir, logAbsolutePath)
    await mkdir(dirname(target), { recursive: true })
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`
    // Small append-only diagnostic log. writeFile with flag=a is atomic enough for the
    // single-render Phase 9 queue and avoids keeping a file handle open across crashes.
    await writeFile(target, line, { encoding: 'utf8', flag: 'a' })
  }

  async cleanupAttempt(paths: RenderAttemptPaths): Promise<void> {
    await rm(paths.attemptDir, { recursive: true, force: true })
  }

  async removeOutput(relativePath: string | null): Promise<void> {
    if (!relativePath) return
    const target = assertInsideProject(this.projectDir, join(this.projectDir, relativePath))
    await rm(target, { force: true })
  }

  async readLog(relativePath: string): Promise<string> {
    const target = assertInsideProject(this.projectDir, join(this.projectDir, relativePath))
    return readFile(target, 'utf8')
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
