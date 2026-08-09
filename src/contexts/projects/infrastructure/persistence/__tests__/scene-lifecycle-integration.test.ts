/**
 * PHASE 3 — Lifecycle integration test: create → modify → undo (restore snapshot) → close → reopen
 * Uses real SQLite (better-sqlite3). No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDrizzleSceneRepository } from '../drizzle-scene-repository'
import { Scene } from '../../../domain/aggregates/scene'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync } from 'fs'
import { ulid } from 'ulid'

function uniqueDbPath() {
  return join(tmpdir(), `scpt-lifecycle-${ulid()}.sqlite`)
}

describe('Scene lifecycle (real SQLite)', () => {
  let dbPath: string
  const projetId = ProjetAudiovisuelId.from(ulid())

  beforeEach(() => { dbPath = uniqueDbPath() })
  afterEach(() => {
    try {
      if (existsSync(dbPath)) unlinkSync(dbPath)
      if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
      if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
    } catch { /* ignore */ }
  })

  it('full cycle: create 3 scenes → modify → undo (restore snapshot) → close → reopen → verify', async () => {
    // Step 1: Create 3 scenes
    const repo = createDrizzleSceneRepository(dbPath)
    const s1 = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'Scene A' })
    const s2 = Scene.create({ projetId, ordre: 2, type: 'texte', titre: 'Scene B' })
    const s3 = Scene.create({ projetId, ordre: 3, type: 'texte', titre: 'Scene C' })
    await repo.save(s1)
    await repo.save(s2)
    await repo.save(s3)

    // Verify initial state
    let seq = await repo.loadSequence(projetId)
    expect(seq).toHaveLength(3)
    expect(seq.map(s => s.titre)).toEqual(['Scene A', 'Scene B', 'Scene C'])

    // Step 2: Modify scene B (change titre → "Scene B modifiée")
    const b = seq[1]
    const bModified = b.update({ titre: 'Scene B modifiée' })
    await repo.save(bModified)

    // Verify modification persisted
    seq = await repo.loadSequence(projetId)
    expect(seq[1].titre).toBe('Scene B modifiée')
    expect(seq[1].version.value).toBe(2) // version incremented

    // Step 3: Undo — restore original Scene B by saving the original snapshot
    await repo.save(b) // save the original (version 1) scene back
    seq = await repo.loadSequence(projetId)
    expect(seq[1].titre).toBe('Scene B') // restored
    expect(seq[1].version.value).toBe(1) // original version

    // Step 4: Close DB via scope (repo goes out of scope implicitly; reopen)
    // In real app, close means quitting Electron; here we recreate the adapter
    const repo2 = createDrizzleSceneRepository(dbPath)
    seq = await repo2.loadSequence(projetId)
    expect(seq).toHaveLength(3)
    expect(seq[1].titre).toBe('Scene B') // undo persisted across reopen
  })

  it('reorder → undo → persist', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const sA = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'A' })
    const sB = Scene.create({ projetId, ordre: 2, type: 'texte', titre: 'B' })
    const sC = Scene.create({ projetId, ordre: 3, type: 'texte', titre: 'C' })
    await repo.save(sA)
    await repo.save(sB)
    await repo.save(sC)

    // Snapshot before reorder
    const beforeIds = [sA.id, sB.id, sC.id]

    // Reorder: C, A, B
    await repo.reorder(projetId, [sC.id, sA.id, sB.id])
    let seq = await repo.loadSequence(projetId)
    expect(seq.map(s => s.id.value)).toEqual([sC.id.value, sA.id.value, sB.id.value])

    // Undo reorder: restore original order
    await repo.reorder(projetId, beforeIds)
    seq = await repo.loadSequence(projetId)
    expect(seq.map(s => s.id.value)).toEqual([sA.id.value, sB.id.value, sC.id.value])
  })
})