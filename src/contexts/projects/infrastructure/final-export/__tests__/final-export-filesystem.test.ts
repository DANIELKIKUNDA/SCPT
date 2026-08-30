import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FinalExportFilesystem, sanitizeExportFileStem } from '../final-export-filesystem'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'scpt-final-export-fs-'))
  roots.push(value)
  return value
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('FinalExportFilesystem', () => {
  it('creates deterministic safe final and temporary paths', async () => {
    const projectDir = root()
    const fs = new FinalExportFilesystem(projectDir)
    const paths = await fs.prepareAttempt({
      exportId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', attempt: 2,
      projectTitle: 'Cours : logarithmes ? RDC', formatLabel: '16x9'
    })
    expect(paths.finalFileName).toMatch(/^Cours_logarithmes_RDC_16x9_[A-Za-z0-9]+\.mp4$/)
    expect(paths.finalRelativePath.startsWith('renders/final/')).toBe(true)
    expect(paths.logRelativePath.startsWith('logs/final-export-')).toBe(true)
    expect(paths.attemptDir).toContain('temp')
  })

  it('sanitizes Windows-invalid filename characters', () => {
    expect(sanitizeExportFileStem('  Math <Algèbre>: chapitre / 1 *  ')).toBe('Math_Algèbre_chapitre_1')
    expect(sanitizeExportFileStem('...   ')).toBe('SCPT')
  })

  it('refuses project path traversal', () => {
    const projectDir = root()
    const fs = new FinalExportFilesystem(projectDir)
    expect(() => fs.absoluteFromRelative('../escape.mp4')).toThrow('FINAL_EXPORT_INVALID_RELATIVE_PATH')
    expect(() => fs.absoluteFromRelative('renders\\final\\escape.mp4')).toThrow('FINAL_EXPORT_INVALID_RELATIVE_PATH')
    expect(() => fs.absoluteFromRelative('C:/escape.mp4')).toThrow('FINAL_EXPORT_INVALID_RELATIVE_PATH')
    expect(() => fs.absoluteFromRelative('/escape.mp4')).toThrow('FINAL_EXPORT_INVALID_RELATIVE_PATH')
  })

  it('verifies source checksums and detects source mutation', async () => {
    const projectDir = root()
    await mkdir(join(projectDir, 'renders', 'previews'), { recursive: true })
    const path = join(projectDir, 'renders', 'previews', 'source.mp4')
    await writeFile(path, 'source-a')
    const fs = new FinalExportFilesystem(projectDir)
    await expect(fs.verifyChecksum(path, sha('source-a'))).resolves.toBeUndefined()
    await writeFile(path, 'source-b')
    await expect(fs.verifyChecksum(path, sha('source-a'))).rejects.toThrow('FINAL_EXPORT_SOURCE_CHECKSUM_MISMATCH')
  })

  it('preflights disk capacity without filling the disk', async () => {
    const projectDir = root()
    const video = join(projectDir, 'video.mp4')
    const audio = join(projectDir, 'audio.wav')
    writeFileSync(video, Buffer.alloc(1024))
    writeFileSync(audio, Buffer.alloc(1024))
    const attemptDir = join(projectDir, 'temp')
    await mkdir(attemptDir, { recursive: true })
    const fs = new FinalExportFilesystem(projectDir, async () => 1024)
    await expect(fs.assertSufficientDiskSpace({ sourceVideo: video, sourceAudio: audio, destinationDir: attemptDir }))
      .rejects.toThrow('FINAL_EXPORT_DISK_SPACE_INSUFFICIENT')
  })

  it('commits a verified output immutably and returns SHA-256', async () => {
    const projectDir = root()
    const fs = new FinalExportFilesystem(projectDir)
    const paths = await fs.prepareAttempt({ exportId: 'EXP123456789', attempt: 1, projectTitle: 'SCPT', formatLabel: '9x16' })
    await writeFile(paths.temporaryOutput, 'final-video')
    const committed = await fs.commitVerifiedOutput(paths)
    expect(committed.checksum).toBe(sha('final-video'))
    expect(committed.sizeBytes).toBe(Buffer.byteLength('final-video'))
    expect(existsSync(paths.finalAbsolutePath)).toBe(true)
    expect(readFileSync(paths.finalAbsolutePath, 'utf8')).toBe('final-video')
  })

  it('refuses to overwrite an existing final output', async () => {
    const projectDir = root()
    const fs = new FinalExportFilesystem(projectDir)
    const first = await fs.prepareAttempt({ exportId: 'EXP123456789', attempt: 1, projectTitle: 'SCPT', formatLabel: '16x9' })
    await writeFile(first.temporaryOutput, 'first')
    await fs.commitVerifiedOutput(first)
    await expect(fs.prepareAttempt({ exportId: 'EXP123456789', attempt: 2, projectTitle: 'SCPT', formatLabel: '16x9' }))
      .rejects.toThrow('FINAL_EXPORT_OUTPUT_EXISTS')
  })

  it('appends JSONL diagnostics and removes only the attempt directory', async () => {
    const projectDir = root()
    const fs = new FinalExportFilesystem(projectDir)
    const paths = await fs.prepareAttempt({ exportId: 'EXP123456789', attempt: 1, projectTitle: 'SCPT', formatLabel: '16x9' })
    await fs.appendLog(paths.logAbsolutePath, { event: 'test', value: 42 })
    const content = await fs.readLog(paths.logRelativePath)
    expect(content).toContain('"event":"test"')
    expect(content).toContain('"value":42')
    await fs.cleanupAttempt(paths)
    expect(existsSync(paths.attemptDir)).toBe(false)
    expect(existsSync(paths.logAbsolutePath)).toBe(true)
  })
})
