import { describe, it, expect } from 'vitest'
import { RessourceMedia } from '../ressource-media'
import { RessourceMediaId } from '../../value-objects/ressource-media-id'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'
import { ulid } from 'ulid'

describe('RessourceMedia (domain)', () => {
  const projetId = ProjetAudiovisuelId.from(ulid())

  it('creates a valid resource', () => {
    const media = RessourceMedia.create({
      projetId,
      type: 'image',
      cheminRelatif: 'media/source/photo.png',
      nomOriginal: 'photo.png',
      checksum: 'abc123',
      tailleOctets: 1024,
      mimeType: 'image/png'
    })
    expect(media.id).toBeDefined()
    expect(media.type).toBe('image')
    expect(media.cheminRelatif).toBe('media/source/photo.png')
    expect(media.statut).toBe('disponible')
    expect(media.droits).toBe('inconnue')
    expect(media.version.value).toBe(1)
  })

  it('rejects empty cheminRelatif', () => {
    expect(() => RessourceMedia.create({
      projetId, type: 'image', cheminRelatif: '', nomOriginal: 'x', checksum: 'a', tailleOctets: 0, mimeType: 'image/png'
    })).toThrow('cheminRelatif')
  })

  it('rejects backslash in cheminRelatif', () => {
    expect(() => RessourceMedia.create({
      projetId, type: 'image', cheminRelatif: 'media\\photo.png', nomOriginal: 'x', checksum: 'a', tailleOctets: 0, mimeType: 'image/png'
    })).toThrow('cheminRelatif')
  })

  it('rejects invalid type', () => {
    expect(() => RessourceMedia.create({
      projetId, type: 'invalid' as any, cheminRelatif: 'm/p.png', nomOriginal: 'x', checksum: 'a', tailleOctets: 0, mimeType: 'image/png'
    })).toThrow('Invalid MediaType')
  })

  it('allows all valid types', () => {
    for (const t of ['image', 'video', 'audio', 'musique', 'logo', 'document']) {
      const m = RessourceMedia.create({ projetId, type: t, cheminRelatif: 'm/f.png', nomOriginal: 'f.png', checksum: 'a', tailleOctets: 0, mimeType: 'image/png' })
      expect(m.type).toBe(t)
    }
  })

  it('marquerManquante changes statut', () => {
    const media = RessourceMedia.create({ projetId, type: 'image', cheminRelatif: 'm/f.png', nomOriginal: 'f.png', checksum: 'a', tailleOctets: 0, mimeType: 'image/png' })
    const missing = media.marquerManquante()
    expect(missing.statut).toBe('manquante')
    expect(media.statut).toBe('disponible') // original unchanged
    expect(missing.version.value).toBe(2)
  })

  it('restaurer restores statut', () => {
    const media = RessourceMedia.create({ projetId, type: 'image', cheminRelatif: 'm/f.png', nomOriginal: 'f.png', checksum: 'a', tailleOctets: 0, mimeType: 'image/png' })
    const missing = media.marquerManquante()
    const restored = missing.restaurer()
    expect(restored.statut).toBe('disponible')
    expect(restored.version.value).toBe(3)
  })

  it('fromPersistence reconstructs a resource', () => {
    const id = RessourceMediaId.generate()
    const media = RessourceMedia.fromPersistence({
      id, projetId, type: 'audio', cheminRelatif: 'media/voice.wav', nomOriginal: 'voice.wav', checksum: 'sha256:def', tailleOctets: 5000,
      mimeType: 'audio/wav', dureeMs: 3000, largeur: null, hauteur: null, statut: 'disponible', droits: 'libre',
      version: { value: 3 } as any, sourceMediaId: null
    })
    expect(media.id).toEqual(id)
    expect(media.mimeType).toBe('audio/wav')
    expect(media.dureeMs).toBe(3000)
  })
})