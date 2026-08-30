import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RecoverySessionService } from '../recovery-session'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-recovery11-'))
  roots.push(root)
  return { root, service: new RecoverySessionService(root) }
}

describe('RecoverySessionService', () => {
  it('does not report a crash without an active-session marker', async () => {
    const { service } = fixture()
    await expect(service.detectPreviousCrash('p1')).resolves.toBe(false)
  })

  it('detects an unclean previous session and removes the marker on clean close', async () => {
    const { root, service } = fixture()
    await service.markOpen('p1')
    await expect(service.detectPreviousCrash('p1')).resolves.toBe(true)
    await service.markCleanClose()
    expect(existsSync(join(root, 'recovery', 'active-session.json'))).toBe(false)
  })

  it('treats a malformed marker as an unclean state rather than crashing', async () => {
    const { root, service } = fixture()
    mkdirSync(join(root, 'recovery'), { recursive: true })
    writeFileSync(join(root, 'recovery', 'active-session.json'), '{broken', 'utf-8')
    await expect(service.detectPreviousCrash('p1')).resolves.toBe(true)
  })
})
