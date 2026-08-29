import { describe, expect, it } from 'vitest'
import type { DeclinaisonAudiovisuelle } from '../../../../domain/aggregates/declinaison-audiovisuelle'
import type { DeclinaisonAudiovisuelleRepository } from '../../../../domain/repositories/declinaison-audiovisuelle.repository'
import { FormatVideo } from '../../../../domain/value-objects/format-video'
import { ProfilExport } from '../../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../../domain/value-objects/version-metier'
import type { ProjectSourceVersionPort } from '../../../ports/project-source-version.port'
import { CreateDeclinaisonUseCase } from '../create-declinaison.use-case'
import { ListDeclinaisonsUseCase } from '../list-declinaisons.use-case'
import { SetDeclinaisonOverrideUseCase } from '../set-declinaison-override.use-case'

const projectId = ProjetAudiovisuelId.from('01J00000000000000000000000')

class MemoryDeclinaisonRepository implements DeclinaisonAudiovisuelleRepository {
  values: DeclinaisonAudiovisuelle[] = []

  async save(value: DeclinaisonAudiovisuelle): Promise<void> {
    this.values = [...this.values.filter((item) => item.id.value !== value.id.value), value]
  }

  async findById(id: { value: string }): Promise<DeclinaisonAudiovisuelle | null> {
    return this.values.find((item) => item.id.value === id.value) ?? null
  }

  async findAllByProject(id: ProjetAudiovisuelId): Promise<DeclinaisonAudiovisuelle[]> {
    return this.values.filter((item) => item.projetId.equals(id))
  }

  async findCurrentBySignature(input: {
    projectId: ProjetAudiovisuelId
    format: FormatVideo
    langue: string
    profilExport: ProfilExport
  }): Promise<DeclinaisonAudiovisuelle | null> {
    return this.values.find((item) =>
      item.projetId.equals(input.projectId) &&
      item.format.equals(input.format) &&
      item.langue === input.langue &&
      item.profilExport.equals(input.profilExport) &&
      !item.isObsolete
    ) ?? null
  }
}

function source(version: number): ProjectSourceVersionPort {
  return { current: () => VersionMetier.from(version) }
}

describe('Phase 8 declination use cases', () => {
  it('creates a canonical vertical declination from current source version', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const value = await new CreateDeclinaisonUseCase(repository, source(5)).execute({
      projectId: projectId.value,
      format: 'VERTICAL_9_16',
      langue: 'fr'
    })
    expect(value.versionProjetSource.value).toBe(5)
    expect(value.resolution.value).toEqual({ width: 1080, height: 1920 })
    expect(repository.values).toHaveLength(1)
  })

  it('returns the existing current signature instead of duplicating it', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const useCase = new CreateDeclinaisonUseCase(repository, source(1))
    const first = await useCase.execute({ projectId: projectId.value, format: 'HORIZONTAL_16_9', langue: 'fr' })
    const second = await useCase.execute({ projectId: projectId.value, format: 'HORIZONTAL_16_9', langue: 'fr' })
    expect(second.id.value).toBe(first.id.value)
    expect(repository.values).toHaveLength(1)
  })

  it('creates a fresh current signature after the previous declination became obsolete', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const firstUseCase = new CreateDeclinaisonUseCase(repository, source(1))
    const first = await firstUseCase.execute({ projectId: projectId.value, format: 'CARRE_1_1', langue: 'fr' })
    await repository.save(first.markObsolete())
    const second = await new CreateDeclinaisonUseCase(repository, source(2)).execute({
      projectId: projectId.value,
      format: 'CARRE_1_1',
      langue: 'fr'
    })
    expect(second.id.value).not.toBe(first.id.value)
    expect(repository.values).toHaveLength(2)
  })


  it('does not overwrite an obsolete historical row when the Phase 7 preferred id is reused', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const first = await new CreateDeclinaisonUseCase(repository, source(1)).execute({
      projectId: projectId.value,
      format: 'HORIZONTAL_16_9',
      langue: 'fr',
      preferredId: '01J00000000000000000000001'
    })
    await repository.save(first.markObsolete())
    const second = await new CreateDeclinaisonUseCase(repository, source(2)).execute({
      projectId: projectId.value,
      format: 'HORIZONTAL_16_9',
      langue: 'fr',
      preferredId: '01J00000000000000000000001'
    })
    expect(second.id.value).not.toBe(first.id.value)
    expect(repository.values).toHaveLength(2)
    expect(repository.values.some((item) => item.id.value === first.id.value && item.isObsolete)).toBe(true)
  })

  it('lazily marks historical variants obsolete when the source version changes', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const value = await new CreateDeclinaisonUseCase(repository, source(1)).execute({
      projectId: projectId.value,
      format: 'HORIZONTAL_16_9',
      langue: 'fr'
    })
    expect(value.statut).toBe('brouillon')
    const listed = await new ListDeclinaisonsUseCase(repository, source(2)).execute(projectId.value)
    expect(listed[0].declinaison.statut).toBe('obsolete')
    expect(listed[0].currentSourceVersion).toBe(2)
  })

  it('rejects visual overrides on a source-obsolete declination', async () => {
    const repository = new MemoryDeclinaisonRepository()
    const value = await new CreateDeclinaisonUseCase(repository, source(1)).execute({
      projectId: projectId.value,
      format: 'VERTICAL_9_16',
      langue: 'fr'
    })
    const useCase = new SetDeclinaisonOverrideUseCase(repository, source(2))
    await expect(useCase.execute({
      projectId: projectId.value,
      declinaisonId: value.id.value,
      sceneId: 'scene-1',
      layout: 'top'
    })).rejects.toThrow('DECLINATION_SOURCE_OBSOLETE')
    expect(repository.values[0].statut).toBe('obsolete')
  })
})
