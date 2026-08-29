import type { DeclinaisonSceneLayout } from '../../../domain/aggregates/declinaison-audiovisuelle'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export class SetDeclinaisonOverrideUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(input: {
    projectId: string
    declinaisonId: string
    sceneId: string
    layout?: DeclinaisonSceneLayout
    backgroundColor?: string
  }) {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const current = await this.repository.findById(DeclinaisonId.from(input.declinaisonId))
    if (!current || !current.projetId.equals(projectId)) throw new Error('Declination not found')
    const sourceVersion = await this.sourceVersion.current(projectId)
    const checked = current.markObsoleteIfSourceChanged(sourceVersion)
    if (checked.isObsolete) {
      if (!current.isObsolete) await this.repository.save(checked)
      throw new Error('DECLINATION_SOURCE_OBSOLETE')
    }
    const updated = checked.setSceneOverride({
      sceneId: input.sceneId,
      layout: input.layout,
      backgroundColor: input.backgroundColor
    })
    await this.repository.save(updated)
    return updated
  }
}
