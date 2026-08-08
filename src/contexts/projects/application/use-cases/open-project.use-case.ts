import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { ProjectNotFoundError } from '../../domain/errors/project-errors'
import type { ProjetAudiovisuel } from '../../domain/aggregates/projet-audiovisuel'

export class OpenProjectUseCase {
  constructor(private readonly repo: ProjetAudiovisuelRepository) {}

  async execute(projectId: string): Promise<ProjetAudiovisuel> {
    const id = ProjetAudiovisuelId.from(projectId)
    const projet = await this.repo.findById(id)

    if (!projet) {
      throw new ProjectNotFoundError(projectId)
    }

    return projet
  }
}