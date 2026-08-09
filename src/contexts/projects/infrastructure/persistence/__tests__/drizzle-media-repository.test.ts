import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDrizzleMediaRepository } from '../drizzle-media-repository'
import { RessourceMedia } from '../../../domain/aggregates/ressource-media'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync } from 'fs'
import { ulid } from 'ulid'

function uniqueDbPath() { return join(tmpdir(), 'scpt-media-' + ulid() + '.sqlite') }

describe('DrizzleMediaRepository (real SQLite)', () => {
  let dbPath: string
  const projetId = ProjetAudiovisuelId.from(ulid())

  beforeEach(() => { dbPath = uniqueDbPath() })
  afterEach(() => {
    try { if (existsSync(dbPath)) unlinkSync(dbPath); if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal'); if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm') } catch {}
  })

  function make(title: string) {
    return RessourceMedia.create({ projetId, type: 'image', cheminRelatif: 'media/source/' + title, nomOriginal: title, checksum: 'sha256:' + title, tailleOctets: 100, mimeType: 'image/png' })
  }

  it('saves and retrieves', async () => {
    const repo = createDrizzleMediaRepository(dbPath)
    const m = make('photo.png')
    await repo.save(m)
    const found = await repo.findById(m.id)
    expect(found).not.toBeNull()
    expect(found!.nomOriginal).toBe('photo.png')
  })

  it('finds all ordered', async () => {
    const repo = createDrizzleMediaRepository(dbPath)
    await repo.save(make('b.png'))
    await repo.save(make('a.png'))
    const all = await repo.findAll(projetId)
    expect(all).toHaveLength(2)
    expect(all[0].nomOriginal).toBe('a.png')
    expect(all[1].nomOriginal).toBe('b.png')
  })

  it('finds by checksum', async () => {
    const repo = createDrizzleMediaRepository(dbPath)
    const m = make('x.png')
    await repo.save(m)
    const found = await repo.findByChecksum(projetId, 'sha256:x.png')
    expect(found).not.toBeNull()
  })

  it('close and reopen', async () => {
    const repo1 = createDrizzleMediaRepository(dbPath)
    const m = make('test.png')
    await repo1.save(m)
    const repo2 = createDrizzleMediaRepository(dbPath)
    const found = await repo2.findById(m.id)
    expect(found).not.toBeNull()
    expect(found!.nomOriginal).toBe('test.png')
  })

  it('delete', async () => {
    const repo = createDrizzleMediaRepository(dbPath)
    const m = make('del.png')
    await repo.save(m)
    await repo.delete(m.id)
    expect(await repo.findById(m.id)).toBeNull()
  })
})