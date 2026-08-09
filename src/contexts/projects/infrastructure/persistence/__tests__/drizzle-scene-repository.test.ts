import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDrizzleSceneRepository } from '../drizzle-scene-repository'
import { Scene } from '../../../domain/aggregates/scene'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync } from 'fs'
import { ulid } from 'ulid'

function uniqueDbPath() {
  return join(tmpdir(), `scpt-scene-test-${ulid()}.sqlite`)
}

describe('DrizzleSceneRepository (real SQLite)', () => {
  let dbPath: string
  const projetId = ProjetAudiovisuelId.from(ulid())

  beforeEach(() => {
    dbPath = uniqueDbPath()
  })

  afterEach(() => {
    try {
      if (existsSync(dbPath)) unlinkSync(dbPath)
      if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
      if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
    } catch { /* ignore */ }
  })

  it('creates and persists a scene', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'Intro' })
    await repo.save(scene)

    const found = await repo.findById(scene.id)
    expect(found).not.toBeNull()
    expect(found!.titre).toBe('Intro')
    expect(found!.ordre).toBe(1)
  })

  it('loads sequence ordered by ordre', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const s1 = Scene.create({ projetId, ordre: 2, type: 'texte', titre: 'Second' })
    const s2 = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'First' })
    await repo.save(s1)
    await repo.save(s2)

    const sequence = await repo.loadSequence(projetId)
    expect(sequence).toHaveLength(2)
    expect(sequence[0].titre).toBe('First')
    expect(sequence[1].titre).toBe('Second')
  })

  it('duplicates a scene', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const original = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'Original' })
    await repo.save(original)

    const dup = await repo.duplicate(original.id)
    expect(dup.titre).toBe('Original (copie)')
    expect(dup.ordre).toBe(2)

    const sequence = await repo.loadSequence(projetId)
    expect(sequence).toHaveLength(2)
  })

  it('deletes and re-compacts order', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const s1 = Scene.create({ projetId, ordre: 1, type: 'texte' })
    const s2 = Scene.create({ projetId, ordre: 2, type: 'texte' })
    const s3 = Scene.create({ projetId, ordre: 3, type: 'texte' })
    await repo.save(s1)
    await repo.save(s2)
    await repo.save(s3)

    await repo.delete(s2.id)

    const sequence = await repo.loadSequence(projetId)
    expect(sequence).toHaveLength(2)
    expect(sequence[0].ordre).toBe(1)
    expect(sequence[1].ordre).toBe(2) // was 3, now compacted to 2
  })

  it('reorders atomically (A B C → C A B)', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const sA = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'A' })
    const sB = Scene.create({ projetId, ordre: 2, type: 'texte', titre: 'B' })
    const sC = Scene.create({ projetId, ordre: 3, type: 'texte', titre: 'C' })
    await repo.save(sA)
    await repo.save(sB)
    await repo.save(sC)

    await repo.reorder(projetId, [sC.id, sA.id, sB.id])

    const sequence = await repo.loadSequence(projetId)
    expect(sequence[0].titre).toBe('C')
    expect(sequence[1].titre).toBe('A')
    expect(sequence[2].titre).toBe('B')
  })

  it('reorder rolls back completely if IDs mismatch', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const sA = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'A' })
    const sB = Scene.create({ projetId, ordre: 2, type: 'texte', titre: 'B' })
    await repo.save(sA)
    await repo.save(sB)

    // Try reorder with only one ID — should fail
    await expect(repo.reorder(projetId, [sA.id])).rejects.toThrow()

    const sequence = await repo.loadSequence(projetId)
    expect(sequence[0].titre).toBe('A') // unchanged
    expect(sequence[1].titre).toBe('B') // unchanged
  })

  it('closes and reopens preserving data', async () => {
    const repo1 = createDrizzleSceneRepository(dbPath)
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'Persist' })
    await repo1.save(scene)

    // Reopen with a new adapter instance
    const repo2 = createDrizzleSceneRepository(dbPath)
    const found = await repo2.findById(scene.id)
    expect(found).not.toBeNull()
    expect(found!.titre).toBe('Persist')
  })

  it('maintains unique order per project', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const s1 = Scene.create({ projetId, ordre: 1, type: 'texte' })
    const s2 = Scene.create({ projetId, ordre: 1, type: 'texte' }) // same order
    await repo.save(s1)

    // Second save with same order should replace (INSERT OR REPLACE)
    await repo.save(s2)
    const sequence = await repo.loadSequence(projetId)
    expect(sequence).toHaveLength(1)
  })
})