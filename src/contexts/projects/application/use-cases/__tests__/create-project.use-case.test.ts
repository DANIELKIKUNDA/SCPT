import { describe, it, expect, beforeEach } from 'vitest'
import { CreateProjectUseCase } from '../create-project.use-case'
import { InMemoryProjetAudiovisuelRepository } from '../../../infrastructure/persistence/in-memory-project-repository'

describe('CreateProjectUseCase', () => {
  let repo: InMemoryProjetAudiovisuelRepository
  let useCase: CreateProjectUseCase

  beforeEach(() => {
    repo = new InMemoryProjetAudiovisuelRepository()
    useCase = new CreateProjectUseCase(repo)
  })

  it('cree et persiste un projet', async () => {
    const projet = await useCase.execute({
      titre: 'Projet Test',
      type: 'tutoriel',
      objectif: 'Apprendre TypeScript',
      publicCible: 'Developpeurs',
      langueSource: 'fr'
    })

    expect(projet.id).toBeDefined()
    expect(projet.titre).toBe('Projet Test')
    expect(projet.statut).toBe('BROUILLON')

    const found = await repo.findById(projet.id)
    expect(found).not.toBeNull()
    expect(found!.titre).toBe('Projet Test')
  })

  it('rejette une entree invalide (titre vide)', async () => {
    await expect(
      useCase.execute({
        titre: '',
        type: 'demo',
        objectif: 'Test',
        publicCible: 'All',
        langueSource: 'fr'
      })
    ).rejects.toThrow()
  })

  it('rejette un objet sans titre', async () => {
    await expect(
      useCase.execute({
        type: 'demo',
        objectif: 'Test',
        publicCible: 'All',
        langueSource: 'fr'
      })
    ).rejects.toThrow()
  })
})