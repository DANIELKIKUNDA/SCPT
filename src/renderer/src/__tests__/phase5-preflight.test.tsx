/**
 * PHASE 5 — permanent compatibility guard for the dependencies
 * that were validated in the Electron runtime preflight.
 */
import { describe, it, expect } from 'vitest'

describe('Phase 5 dependency spikes', () => {
  it('A. remotion — core available', async () => {
    const remotion = await import('remotion')
    expect(remotion).not.toBeNull()
    expect(remotion).toHaveProperty('Composition')
    expect(remotion).toHaveProperty('useCurrentFrame')
    expect(remotion).toHaveProperty('useVideoConfig')
  })

  it('B. @remotion/player — Player available', async () => {
    const player = await import('@remotion/player')
    expect(player).not.toBeNull()
    expect(player).toHaveProperty('Player')
  })

  it('C. katex — KaTeX render available', async () => {
    const katex = await import('katex')
    expect(katex).not.toBeNull()
    const mod = (katex as Record<string, unknown>).default ?? katex
    expect(typeof (mod as Record<string, unknown>).renderToString).toBe('function')
  })

  it('D. react-katex — KaTeX React components available', async () => {
    const reactKatex = await import('react-katex')
    expect(reactKatex).not.toBeNull()
    expect(reactKatex).toHaveProperty('InlineMath')
    expect(reactKatex).toHaveProperty('BlockMath')
  })

  it('E. @monaco-editor/react — Monaco Editor available', async () => {
    const monaco = await import('@monaco-editor/react')
    expect(monaco).not.toBeNull()
    expect(monaco).toHaveProperty('Editor')
  })

  it('F. recharts — Recharts components available', async () => {
    const recharts = await import('recharts')
    expect(recharts).not.toBeNull()
    expect(recharts).toHaveProperty('LineChart')
    expect(recharts).toHaveProperty('Line')
    expect(recharts).toHaveProperty('XAxis')
    expect(recharts).toHaveProperty('YAxis')
  })
})