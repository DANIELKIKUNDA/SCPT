import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export class MarkDeclinaisonReadyUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(input: { projectId: string; declinaisonId: string }) {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const declinaison = await this.repository.findById(DeclinaisonId.from(input.declinaisonId))
    if (!declinaison || !declinaison.projetId.equals(projectId)) throw new Error('Declination not found')
    const currentVersion = await this.sourceVersion.current(projectId)
    const ready = declinaison.markReadyForRender(currentVersion)
    await this.repository.save(ready)
    return ready
  }
}
