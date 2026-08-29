import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export class RemoveDeclinaisonOverrideUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(projectIdValue: string, declinaisonId: string, sceneId: string) {
    const projectId = ProjetAudiovisuelId.from(projectIdValue)
    const current = await this.repository.findById(DeclinaisonId.from(declinaisonId))
    if (!current || !current.projetId.equals(projectId)) throw new Error('Declination not found')
    const sourceVersion = await this.sourceVersion.current(projectId)
    const checked = current.markObsoleteIfSourceChanged(sourceVersion)
    if (checked.isObsolete) {
      if (!current.isObsolete) await this.repository.save(checked)
      throw new Error('DECLINATION_SOURCE_OBSOLETE')
    }
    const updated = checked.removeSceneOverride(sceneId)
    await this.repository.save(updated)
    return updated
  }
}
