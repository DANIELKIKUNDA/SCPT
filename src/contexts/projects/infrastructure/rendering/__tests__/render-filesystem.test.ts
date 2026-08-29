import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RenderFilesystem } from '../render-filesystem'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-render-fs-'))
  roots.push(root)
  return { root, fs: new RenderFilesystem(root) }
}

describe('RenderFilesystem', () => {
  it('creates one isolated temp folder per attempt', async () => {
    const { fs } = fixture()
    const one = await fs.prepareAttempt({ jobId: 'job-1', attempt: 1, formatLabel: '16x9' })
    const two = await fs.prepareAttempt({ jobId: 'job-1', attempt: 2, formatLabel: '16x9' })
    expect(one.attemptDir).not.toBe(two.attemptDir)
    expect(one.finalRelativePath).toContain('renders/previews/')
  })

  it('commits a non-empty intermediate file and computes sha256', async () => {
    const { fs } = fixture()
    const paths = await fs.prepareAttempt({ jobId: 'job-2', attempt: 1, formatLabel: '9x16' })
    writeFileSync(paths.temporaryOutput, Buffer.from('real-ish-render-bytes'))
    const result = await fs.commitTemporaryOutput(paths)
    expect(result.sizeBytes).toBeGreaterThan(0)
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(readFileSync(paths.finalAbsolutePath, 'utf8')).toBe('real-ish-render-bytes')
  })

  it('refuses to commit an empty render', async () => {
    const { fs } = fixture()
    const paths = await fs.prepareAttempt({ jobId: 'job-3', attempt: 1, formatLabel: '1x1' })
    writeFileSync(paths.temporaryOutput, '')
    await expect(fs.commitTemporaryOutput(paths)).rejects.toThrow('RENDER_OUTPUT_EMPTY')
  })

  it('never overwrites an already committed immutable preview', async () => {
    const { fs } = fixture()
    const paths = await fs.prepareAttempt({ jobId: 'job-immutable', attempt: 1, formatLabel: '16x9' })
    writeFileSync(paths.finalAbsolutePath, 'existing-render')
    writeFileSync(paths.temporaryOutput, 'replacement-render')
    await expect(fs.commitTemporaryOutput(paths)).rejects.toThrow('RENDER_OUTPUT_ALREADY_EXISTS')
    expect(readFileSync(paths.finalAbsolutePath, 'utf8')).toBe('existing-render')
  })

  it('writes append-only JSONL diagnostics', async () => {
    const { fs } = fixture()
    const paths = await fs.prepareAttempt({ jobId: 'job-4', attempt: 1, formatLabel: '16x9' })
    await fs.appendLog(paths.logAbsolutePath, { event: 'start' })
    await fs.appendLog(paths.logAbsolutePath, { event: 'finish' })
    const lines = (await fs.readLog(paths.logRelativePath)).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).event).toBe('start')
  })

  it('cleans only temporary attempt data', async () => {
    const { fs } = fixture()
    const paths = await fs.prepareAttempt({ jobId: 'job-5', attempt: 1, formatLabel: '16x9' })
    writeFileSync(paths.temporaryOutput, 'x')
    await fs.cleanupAttempt(paths)
    await expect(fs.readLog(paths.logRelativePath)).rejects.toThrow()
  })
})
