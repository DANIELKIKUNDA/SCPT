import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { safeDestPath } from '../media-filesystem'

const created: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scpt-media-path-'))
  created.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('Phase 5 media-path regression guard', () => {
  it('returns the collision-safe filename that matches the actual destination path', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'image.png'), 'existing')

    const result = safeDestPath(dir, 'image.png')

    expect(result.safeName).toBe('image-1.png')
    expect(result.destPath).toBe(join(dir, 'image-1.png'))
  })

  it('falls back to a safe name when Windows-reserved input is sanitized away', () => {
    const dir = tempDir()
    const result = safeDestPath(dir, 'CON.txt')
    expect(result.safeName.length).toBeGreaterThan(0)
    expect(result.destPath.startsWith(dir)).toBe(true)
  })
})
