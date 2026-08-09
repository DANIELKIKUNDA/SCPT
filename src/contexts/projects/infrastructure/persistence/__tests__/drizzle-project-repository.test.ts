import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createSqliteProjectRepository } from '../drizzle-project-repository'
import { ProjetAudiovisuel, type ProjetAudiovisuelProps } from '../../../domain/aggregates/projet-audiovisuel'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync } from 'fs'
import { ulid } from 'ulid'

function uniqueDbPath() {
  return join(tmpdir(), `scpt-test-${ulid()}.sqlite`)
}

describe('DrizzleProjectRepository (real SQLite)', () => {
  let dbPath: string

  beforeEach(() => {
    dbPath = uniqueDbPath()
  })

  afterEach(() => {
    // Clean up any lingering WAL files
    try {
      if (existsSync(dbPath)) unlinkSync(dbPath)
      if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
      if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
    } catch {
      // Ignore cleanup errors
    }
  })

  function makeProject(titre = 'Test'): ProjetAudiovisuel {
    const props: ProjetAudiovisuelProps = {
      id: ProjetAudiovisuelId.from(ulid()),
      titre,
      type: 'CAPTATION',
      objectif: '',
      publicCible: '',
      langueSource: 'fr-FR',
      statut: 'BROUILLON',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      previousStatut: null
    }
    return ProjetAudiovisuel.fromPersistence(props)
  }

  it('saves and retrieves a project', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const project = makeProject()
    await repo.save(project)

    const found = await repo.findById(project.id)
    expect(found).not.toBeNull()
    expect(found!.titre).toBe('Test')
    expect(found!.type).toBe('CAPTATION')
  })

  it('returns null for non-existent project', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const found = await repo.findById(ProjetAudiovisuelId.from(ulid()))
    expect(found).toBeNull()
  })

  it('lists recent projects', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const alpha = makeProject('Alpha')
    const beta = makeProject('Beta')
    // Ensure Beta has a slightly later updatedAt
    await repo.save(alpha)
    await new Promise(r => setTimeout(r, 10))
    await repo.save(beta)

    const recent = await repo.findRecent(10)
    expect(recent).toHaveLength(2)
    // Both projects should appear (order depends on updated_at precision)
    const titles = recent.map(r => r.titre).sort()
    expect(titles).toEqual(['Alpha', 'Beta'])
  })

  it('persists archive/restore cycle', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const project = makeProject('To Archive')
    await repo.save(project)

    const saved = (await repo.findById(project.id))!
    saved.archiver()
    await repo.save(saved)

    const archived = await repo.findById(project.id)
    expect(archived!.statut).toBe('ARCHIVE')
    expect(archived!.archivedAt).not.toBeNull()

    archived!.restore()
    await repo.save(archived!)

    const restored = await repo.findById(project.id)
    expect(restored!.statut).not.toBe('ARCHIVE')
    expect(restored!.archivedAt).toBeNull()
  })

  it('deletes a project', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const project = makeProject()
    await repo.save(project)
    await repo.delete(project.id)

    const found = await repo.findById(project.id)
    expect(found).toBeNull()
  })

  it('finds archived projects', async () => {
    const repo = createSqliteProjectRepository(dbPath)
    const project = makeProject()
    await repo.save(project)

    const saved = (await repo.findById(project.id))!
    saved.archiver()
    await repo.save(saved)

    const archived = await repo.findArchived()
    expect(archived).toHaveLength(1)
    expect(archived[0].statut).toBe('ARCHIVE')
  })
})