import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDrizzleSubtitleRepository } from '../drizzle-subtitle-repository'
import { PisteSousTitres } from '../../../domain/aggregates/piste-sous-titres'
import { VersionMetier } from '../../../domain/value-objects/version-metier'

describe('DrizzleSubtitleRepository', () => {
  let dir: string
  let dbPath: string
  let opened: Array<ReturnType<typeof createDrizzleSubtitleRepository>>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scpt-subtitle-repo-'))
    dbPath = join(dir, 'project.sqlite')
    opened = []
  })

  afterEach(() => {
    for (const repo of opened) {
      try { repo.close() } catch { /* already closed by the test */ }
    }
    rmSync(dir, { recursive: true, force: true })
  })

  function openRepository() {
    const repo = createDrizzleSubtitleRepository(dbPath)
    opened.push(repo)
    return repo
  }

  it('persists and restores a validated subtitle track', async () => {
    const repo = openRepository()
    let track = PisteSousTitres.create({ langue: 'fr', versionNarration: VersionMetier.from(3) })
    track = track.synchronize([
      { debutMs: 0, finMs: 1200, texte: 'Bonjour', position: 'bas' },
      { debutMs: 1200, finMs: 2600, texte: 'Suite', position: 'haut', style: { fontSize: 40 } }
    ], VersionMetier.from(3)).validateAgainst(VersionMetier.from(3))
    await repo.save(track)
    const id = track.id.value
    const declinaisonId = track.declinaisonId.value
    repo.close()

    const reopened = openRepository()
    const restored = await reopened.findMaster()
    expect(restored?.id.value).toBe(id)
    expect(restored?.declinaisonId.value).toBe(declinaisonId)
    expect(restored?.statut).toBe('validee')
    expect(restored?.versionNarration.value).toBe(3)
    expect(restored?.segments).toHaveLength(2)
    expect(restored?.segments[1].style?.fontSize).toBe(40)
    reopened.close()
  })

  it('replaces persisted segments atomically on save', async () => {
    const repo = openRepository()
    let track = PisteSousTitres.create({ langue: 'fr' }).synchronize([
      { debutMs: 0, finMs: 1000, texte: 'A', position: 'bas' },
      { debutMs: 1000, finMs: 2000, texte: 'B', position: 'bas' }
    ], VersionMetier.initial())
    await repo.save(track)
    track = track.deleteSegment(track.segments[0].id)
    await repo.save(track)

    const restored = await repo.findMaster()
    expect(restored?.segments).toHaveLength(1)
    expect(restored?.segments[0].texte).toBe('B')
    expect(restored?.segments[0].ordre).toBe(1)
    repo.close()
  })
})
