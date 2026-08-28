import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDrizzleSceneRepository } from '../drizzle-scene-repository'
import { Scene } from '../../../domain/aggregates/scene'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync } from 'fs'
import { ulid } from 'ulid'
import Database from 'better-sqlite3'

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



  it('migrates the Phase 3 scene CHECK constraint to include diagramme without losing data', async () => {
    const raw = new Database(dbPath)
    raw.exec(`
      CREATE TABLE scenes (
        id TEXT PRIMARY KEY NOT NULL,
        projet_id TEXT NOT NULL,
        ordre INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('texte','formule','image','code')),
        titre TEXT,
        narration_texte TEXT,
        texte_affiche TEXT,
        duree_ms INTEGER NOT NULL DEFAULT 5000,
        composition_json TEXT NOT NULL DEFAULT '{}',
        transition_json TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX idx_scenes_projet_ordre ON scenes(projet_id, ordre);
    `)
    const legacyId = ulid()
    raw.prepare(`
      INSERT INTO scenes (
        id, projet_id, ordre, type, titre, narration_texte, texte_affiche,
        duree_ms, composition_json, transition_json, version
      ) VALUES (?, ?, 1, 'texte', 'Legacy', NULL, 'Bonjour', 5000, ?, ?, 1)
    `).run(
      legacyId,
      projetId.value,
      JSON.stringify({ backgroundColor: '#1e1e2e', layout: 'centered' }),
      JSON.stringify({ type: 'fade', durationMs: 300 })
    )
    raw.close()

    const repo = createDrizzleSceneRepository(dbPath)
    const legacy = await repo.loadSequence(projetId)
    expect(legacy).toHaveLength(1)
    expect(legacy[0].titre).toBe('Legacy')
    expect(await repo.getMediaId(legacy[0].id)).toBeNull()

    const diagram = Scene.create({ projetId, ordre: 2, type: 'diagramme', titre: 'Graphique' })
    await repo.save(diagram)
    expect((await repo.findById(diagram.id))?.type).toBe('diagramme')
  })

  it('persists Phase 5 diagramme scenes', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const diagram = Scene.create({
      projetId,
      ordre: 1,
      type: 'diagramme',
      titre: 'Progression',
      texteAffiche: 'A: 1\nB: 2'
    })
    await repo.save(diagram)
    const found = await repo.findById(diagram.id)
    expect(found?.type).toBe('diagramme')
  })

  it('preserves media association when autosave updates scene fields', async () => {
    const repo = createDrizzleSceneRepository(dbPath)
    const scene = Scene.create({ projetId, ordre: 1, type: 'image', titre: 'Avant' })
    await repo.save(scene)
    await repo.associateMedia(scene.id, '01ARZ3NDEKTSV4RRFFQ69G5FAV')

    await repo.save(scene.update({ titre: 'Après' }))

    expect(await repo.getMediaId(scene.id)).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV')
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