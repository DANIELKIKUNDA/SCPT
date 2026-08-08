import { describe, it, expect } from 'vitest'
import { ProjetAudiovisuel } from '../projet-audiovisuel'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'

describe('ProjetAudiovisuel', () => {
  describe('create', () => {
    it('cree un projet avec le statut BROUILLON', () => {
      const projet = ProjetAudiovisuel.create({
        titre: 'Mon projet',
        type: 'tutoriel',
        objectif: 'Apprendre',
        publicCible: 'Etudiants',
        langueSource: 'fr'
      })

      expect(projet.id).toBeInstanceOf(ProjetAudiovisuelId)
      expect(projet.titre).toBe('Mon projet')
      expect(projet.type).toBe('tutoriel')
      expect(projet.statut).toBe('BROUILLON')
      expect(projet.version).toBe(1)
      expect(projet.isArchived).toBe(false)
    })

    it('rejette un titre vide', () => {
      expect(() =>
        ProjetAudiovisuel.create({
          titre: '',
          type: 'demo',
          objectif: 'Test',
          publicCible: 'All',
          langueSource: 'fr'
        })
      ).toThrow('titre')
    })

    it('rejette un type vide', () => {
      expect(() =>
        ProjetAudiovisuel.create({
          titre: 'Test',
          type: '',
          objectif: 'Test',
          publicCible: 'All',
          langueSource: 'fr'
        })
      ).toThrow('type')
    })

    it('rejette une langue source vide', () => {
      expect(() =>
        ProjetAudiovisuel.create({
          titre: 'Test',
          type: 'demo',
          objectif: 'Test',
          publicCible: 'All',
          langueSource: ''
        })
      ).toThrow('langue')
    })
  })

  describe('fromPersistence', () => {
    it('reconstruit un projet depuis les props persistees', () => {
      const id = ProjetAudiovisuelId.generate()
      const now = new Date()
      const projet = ProjetAudiovisuel.fromPersistence({
        id,
        titre: 'Projet Existant',
        type: 'cours',
        objectif: 'Former',
        publicCible: 'Adultes',
        langueSource: 'fr',
        statut: 'EN_PRODUCTION',
        version: 3,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        previousStatut: null
      })

      expect(projet.titre).toBe('Projet Existant')
      expect(projet.statut).toBe('EN_PRODUCTION')
      expect(projet.version).toBe(3)
    })
  })

  describe('archiver', () => {
    it('passe le statut a ARCHIVE', () => {
      const projet = ProjetAudiovisuel.create({
        titre: 'A archiver',
        type: 'test',
        objectif: 'Test',
        publicCible: 'Tous',
        langueSource: 'fr'
      })

      projet.archiver()
      expect(projet.isArchived).toBe(true)
      expect(projet.statut).toBe('ARCHIVE')
      expect(projet.archivedAt).toBeInstanceOf(Date)
    })
  })

  describe('restore', () => {
    it('restaure un projet archive', () => {
      const projet = ProjetAudiovisuel.create({
        titre: 'A restaurer',
        type: 'test',
        objectif: 'Test',
        publicCible: 'Tous',
        langueSource: 'fr'
      })

      projet.archiver()
      projet.restore()

      expect(projet.isArchived).toBe(false)
      expect(projet.statut).toBe('BROUILLON')
      expect(projet.archivedAt).toBeNull()
    })

    it('echoue si le projet n est pas archive', () => {
      const projet = ProjetAudiovisuel.create({
        titre: 'Actif',
        type: 'test',
        objectif: 'Test',
        publicCible: 'Tous',
        langueSource: 'fr'
      })

      expect(() => projet.restore()).toThrow('restauré')
    })
  })
})