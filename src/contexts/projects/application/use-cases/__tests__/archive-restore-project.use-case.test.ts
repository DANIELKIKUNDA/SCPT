import { describe, it, expect, beforeEach } from 'vitest'
import { CreateProjectUseCase } from '../create-project.use-case'
import { ArchiveProjectUseCase } from '../archive-project.use-case'
import { RestoreProjectUseCase } from '../restore-project.use-case'
import { InMemoryProjetAudiovisuelRepository } from '../../../infrastructure/persistence/in-memory-project-repository'

describe('ArchiveProjectUseCase + RestoreProjectUseCase', () => {
  let repo: InMemoryProjetAudiovisuelRepository
  let create: CreateProjectUseCase
  let archive: ArchiveProjectUseCase
  let restore: RestoreProjectUseCase

  beforeEach(() => {
    repo = new InMemoryProjetAudiovisuelRepository()
    create = new CreateProjectUseCase(repo)
    archive = new ArchiveProjectUseCase(repo)
    restore = new RestoreProjectUseCase(repo)
  })

  it('archive un projet puis le restaure', async () => {
    const projet = await create.execute({
      titre: 'Projet A/R',
      type: 'test',
      objectif: 'Test archive',
      publicCible: 'Tous',
      langueSource: 'fr'
    })

    const archived = await archive.execute(projet.id.value)
    expect(archived.isArchived).toBe(true)
    expect(archived.statut).toBe('ARCHIVE')

    const restored = await restore.execute(projet.id.value)
    expect(restored.isArchived).toBe(false)
    expect(restored.statut).toBe('BROUILLON')
  })

  it('echoue a archiver un projet inexistant', async () => {
    await expect(archive.execute('01KZFTFDQ8DHJPRFV2Y3JPJPT6')).rejects.toThrow('non trouvé')
  })

  it('echoue a restaurer un projet inexistant', async () => {
    await expect(restore.execute('01KZFTFDQ8DHJPRFV2Y3JPJPT6')).rejects.toThrow('non trouvé')
  })
})