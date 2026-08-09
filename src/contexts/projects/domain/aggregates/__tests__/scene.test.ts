import { describe, it, expect } from 'vitest'
import { Scene } from '../scene'
import { SceneId } from '../../value-objects/scene-id'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'
import { ulid } from 'ulid'

describe('Scene (domain invariants)', () => {
  const projetId = ProjetAudiovisuelId.from(ulid())

  it('creates a valid scene', () => {
    const scene = Scene.create({
      projetId,
      ordre: 1,
      type: 'texte',
      titre: 'Introduction',
      dureeMs: 5000
    })
    expect(scene.id).toBeDefined()
    expect(scene.ordre).toBe(1)
    expect(scene.type).toBe('texte')
    expect(scene.titre).toBe('Introduction')
    expect(scene.dureeMs).toBe(5000)
  })

  it('rejects order < 1', () => {
    expect(() => Scene.create({ projetId, ordre: 0, type: 'texte' })).toThrow('order must be >= 1')
    expect(() => Scene.create({ projetId, ordre: -1, type: 'texte' })).toThrow('order must be >= 1')
  })

  it('rejects duration <= 0', () => {
    expect(() => Scene.create({ projetId, ordre: 1, type: 'texte', dureeMs: 0 })).toThrow('duration must be positive')
    expect(() => Scene.create({ projetId, ordre: 1, type: 'texte', dureeMs: -100 })).toThrow('duration must be positive')
  })

  it('rejects invalid type', () => {
    expect(() => Scene.create({ projetId, ordre: 1, type: 'invalid' as never })).toThrow('Invalid SceneType')
  })

  it('defaults duration to 5000ms', () => {
    const scene = Scene.create({ projetId, ordre: 2, type: 'formule' })
    expect(scene.dureeMs).toBe(5000)
  })

  it('allows all valid scene types', () => {
    for (const type of ['texte', 'formule', 'image', 'code'] as const) {
      const scene = Scene.create({ projetId, ordre: 1, type })
      expect(scene.type).toBe(type)
    }
  })

  it('update preserves unchanged fields', () => {
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'Alpha' })
    const updated = scene.update({ narrationTexte: 'Bonjour' })
    expect(updated.titre).toBe('Alpha')
    expect(updated.narrationTexte).toBe('Bonjour')
    expect(updated.ordre).toBe(1)
  })

  it('update rejects negative duration', () => {
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte' })
    expect(() => scene.update({ dureeMs: -1 })).toThrow('duration must be positive')
  })

  it('withOrdre produces a scene with new order', () => {
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte' })
    const reordered = scene.withOrdre(5)
    expect(reordered.ordre).toBe(5)
    expect(scene.ordre).toBe(1) // original unchanged
  })

  it('SceneId rejects invalid ULID', () => {
    expect(() => SceneId.from('invalid')).toThrow('Invalid SceneId')
  })

  it('fromPersistence reconstructs a scene', () => {
    const id = SceneId.generate()
    const scene = Scene.fromPersistence({
      id,
      projetId,
      ordre: 3,
      type: 'code',
      titre: 'Hello World',
      narrationTexte: null,
      texteAffiche: 'print("hi")',
      dureeMs: 3000,
      composition: { backgroundColor: '#000', layout: 'centered' as const },
      transition: { type: 'none' as const, durationMs: 0 }
    })
    expect(scene.id).toEqual(id)
    expect(scene.titre).toBe('Hello World')
    expect(scene.texteAffiche).toBe('print("hi")')
  })
})