import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { DeclinaisonAudiovisuelle } from '../../../domain/aggregates/declinaison-audiovisuelle'
import { FormatVideo } from '../../../domain/value-objects/format-video'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../domain/value-objects/version-metier'
import { createDrizzleDeclinaisonRepository } from '../drizzle-declinaison-repository'

const projectId = ProjetAudiovisuelId.from('01J00000000000000000000000')
const roots: string[] = []

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'scpt-phase8-decl-'))
  roots.push(root)
  return createDrizzleDeclinaisonRepository(join(root, 'project.sqlite'))
}

function horizontal() {
  return DeclinaisonAudiovisuelle.create({
    projetId: projectId,
    format: FormatVideo.horizontal(),
    langue: 'fr',
    versionProjetSource: VersionMetier.from(2)
  })
}

describe('DrizzleDeclinaisonRepository', () => {
  it('persists and restores aggregate data and overrides', async () => {
    const repository = repo()
    try {
      const expected = horizontal().setSceneOverride({ sceneId: 'scene-1', layout: 'top', backgroundColor: '#111827' })
      await repository.save(expected)
      const restored = await repository.findById(expected.id)
      expect(restored?.format.value).toBe('HORIZONTAL_16_9')
      expect(restored?.resolution.value).toEqual({ width: 1920, height: 1080 })
      expect(restored?.overrides).toEqual([{ sceneId: 'scene-1', layout: 'top', backgroundColor: '#111827' }])
      expect(restored?.versionProjetSource.value).toBe(2)
    } finally {
      repository.close()
    }
  })

  it('updates overrides transactionally without duplicates', async () => {
    const repository = repo()
    try {
      const original = horizontal().setSceneOverride({ sceneId: 'scene-1', layout: 'top' })
      await repository.save(original)
      await repository.save(original.setSceneOverride({ sceneId: 'scene-1', layout: 'centered' }))
      const restored = await repository.findById(original.id)
      expect(restored?.overrides).toHaveLength(1)
      expect(restored?.overrides[0].layout).toBe('centered')
    } finally {
      repository.close()
    }
  })

  it('returns only a non-obsolete declination as current', async () => {
    const repository = repo()
    try {
      const value = horizontal()
      await repository.save(value.markObsolete())
      expect(await repository.findCurrentBySignature({
        projectId,
        format: FormatVideo.horizontal(),
        langue: 'fr',
        profilExport: value.profilExport
      })).toBeNull()
    } finally {
      repository.close()
    }
  })

  it('lists historical obsolete declinations for traceability', async () => {
    const repository = repo()
    try {
      const value = horizontal().markObsolete()
      await repository.save(value)
      const all = await repository.findAllByProject(projectId)
      expect(all).toHaveLength(1)
      expect(all[0].statut).toBe('obsolete')
    } finally {
      repository.close()
    }
  })
})
