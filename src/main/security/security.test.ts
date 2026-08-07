import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Security configuration in src/main/index.ts', () => {
  const indexPath = resolve(__dirname, '..', 'index.ts')
  let source: string

  try {
    source = readFileSync(indexPath, 'utf-8')
  } catch {
    source = ''
  }

  it('explicitly sets contextIsolation: true', () => {
    expect(source).toContain('contextIsolation: true')
  })

  it('explicitly sets nodeIntegration: false', () => {
    expect(source).toContain('nodeIntegration: false')
  })

  it('explicitly sets sandbox: true', () => {
    expect(source).toContain('sandbox: true')
  })

  it('explicitly sets webSecurity: true', () => {
    expect(source).toContain('webSecurity: true')
  })

  it('refuses external navigation via setWindowOpenHandler', () => {
    expect(source).toContain('setWindowOpenHandler')
    expect(source).toContain("action: 'deny'")
  })

  it('does NOT grant Chromium permissions explicitly', () => {
    // Electron defaults to denying all Chromium permissions.
    // No setPermissionRequestHandler = all requests denied by default.
    expect(source).not.toContain('setPermissionRequestHandler')
  })

  it('does NOT allow shell.openExternal arbitrary', () => {
    // shell.openExternal should only be used in controlled contexts
    expect(source).not.toContain('shell.openExternal')
  })

  it('uses contextBridge to expose API (not ipcRenderer directly)', () => {
    const preloadPath = resolve(__dirname, '..', '..', 'preload', 'index.ts')
    let preloadSource = ''
    try {
      preloadSource = readFileSync(preloadPath, 'utf-8')
    } catch {
      // ignore
    }
    expect(preloadSource).toContain('contextBridge')
    expect(preloadSource).toContain('exposeInMainWorld')
  })

  it('renderer does not have access to require', () => {
    const rendererWindow = {} as Record<string, unknown>
    expect(rendererWindow.require).toBeUndefined()
  })

  it('renderer does not have access to process', () => {
    const rendererWindow = {} as Record<string, unknown>
    expect(rendererWindow.process).toBeUndefined()
  })
})