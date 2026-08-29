import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveOfflineRenderBrowser } from '../offline-browser-resolver'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'scpt-browser-'))
  roots.push(value)
  return value
}

describe('resolveOfflineRenderBrowser', () => {
  it('uses an explicit SCPT browser when it exists', () => {
    const base = root()
    const exe = join(base, 'chrome.exe')
    writeFileSync(exe, '')
    expect(resolveOfflineRenderBrowser({ appRoot: base, env: { SCPT_RENDER_BROWSER: exe }, platform: 'win32' })).toBe(exe)
  })

  it('finds a browser already provisioned in .remotion', () => {
    const base = root()
    const folder = join(base, 'node_modules', '.remotion', '.chromium', 'win64', 'Thorium', 'BIN')
    mkdirSync(folder, { recursive: true })
    const exe = join(folder, 'thorium.exe')
    writeFileSync(exe, '')
    expect(resolveOfflineRenderBrowser({ appRoot: base, env: {}, platform: 'linux' })).toBe(exe)
  })

  it('fails closed instead of triggering a browser download', () => {
    const base = root()
    expect(() => resolveOfflineRenderBrowser({ appRoot: base, env: {}, platform: 'linux' })).toThrow('RENDER_BROWSER_UNAVAILABLE')
  })
})
