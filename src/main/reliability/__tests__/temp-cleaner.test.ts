import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectTempCleaner } from '../temp-cleaner'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-temp11-'))
  roots.push(root)
  return { root, cleaner: new ProjectTempCleaner(root) }
}

function put(root: string, relative: string, content: string) {
  const path = join(root, ...relative.split('/'))
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
  return path
}

describe('ProjectTempCleaner', () => {
  it('inspects only canonical disposable roots', async () => {
    const { root, cleaner } = fixture()
    put(root, 'temp/rendering/job-a/chunk.bin', '1234')
    put(root, 'audio/temp/take.tmp', '12')
    put(root, 'media/source/keep.png', 'important')
    await expect(cleaner.inspect()).resolves.toEqual({ entries: 2, bytes: 6 })
  })

  it('cleans abandoned temporaries but never project source files', async () => {
    const { root, cleaner } = fixture()
    const disposable = put(root, 'temp/exporting/export-a/out.tmp', '1234')
    const source = put(root, 'media/source/keep.png', 'important')
    const result = await cleaner.cleanup()
    expect(result.removedEntries).toBe(1)
    expect(existsSync(disposable)).toBe(false)
    expect(existsSync(source)).toBe(true)
  })

  it('skips active task directories by exact task id', async () => {
    const { root, cleaner } = fixture()
    const active = put(root, 'temp/rendering/job-active/file.tmp', 'x')
    const stale = put(root, 'temp/rendering/job-stale/file.tmp', 'y')
    const result = await cleaner.cleanup({ activeNames: new Set(['job-active']) })
    expect(result.skippedActive).toBe(1)
    expect(existsSync(active)).toBe(true)
    expect(existsSync(stale)).toBe(false)
  })
})
