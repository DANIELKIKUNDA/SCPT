import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDrizzleReliabilityRepository } from '../drizzle-reliability-repository'

const roots: string[] = []
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }) })
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-relrepo11-'))
  roots.push(root)
  return createDrizzleReliabilityRepository(join(root, 'project.sqlite'))
}

describe('DrizzleReliabilityRepository', () => {
  it('persists structured audit entries and returns newest first', async () => {
    const repository = repo()
    const make = (id: string, createdAt: string) => ({
      id, projectId: 'p1', status: 'attention' as const,
      anomalies: [{ code: 'TEMP', severity: 'warning' as const, message: 'Temp', detail: null }],
      checklist: [{ id: 'temp', label: 'Temp', status: 'warning' as const, detail: '1' }],
      createdAt
    })
    await repository.saveAudit(make('a1', '2026-01-01'))
    await repository.saveAudit(make('a2', '2026-01-02'))
    const audits = await repository.listAudits('p1')
    expect(audits.map((audit) => audit.id)).toEqual(['a2', 'a1'])
    expect(audits[0].anomalies[0].code).toBe('TEMP')
    repository.close()
  })

  it('persists an applied migration idempotently', async () => {
    const repository = repo()
    expect(await repository.hasMigration('m1')).toBe(false)
    await repository.saveMigration({
      id: 'm1', projectId: 'p1', formatVersion: 2, databaseSchemaVersion: 1,
      appVersion: '1.0.0', details: 'Phase 11', appliedAt: '2026-01-01'
    })
    expect(await repository.hasMigration('m1')).toBe(true)
    repository.close()
  })

  it('limits audit history requests to a bounded deterministic window', async () => {
    const repository = repo()
    for (let index = 0; index < 4; index++) {
      await repository.saveAudit({
        id: `a${index}`, projectId: 'p1', status: 'healthy', anomalies: [], checklist: [],
        createdAt: `2026-01-0${index + 1}`
      })
    }
    expect(await repository.listAudits('p1', 2)).toHaveLength(2)
    repository.close()
  })
})
