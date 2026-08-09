import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { ProjectNotFoundError } from '../../domain/errors/project-errors'
import type { ProjetAudiovisuel } from '../../domain/aggregates/projet-audiovisuel'
import type { LockManager } from '../../../../main/persistence/lock-manager'

export class OpenProjectUseCase {
  constructor(
    private readonly repo: ProjetAudiovisuelRepository,
    private readonly lockManager?: LockManager
  ) {}

  async execute(projectId: string): Promise<ProjetAudiovisuel> {
    const id = ProjetAudiovisuelId.from(projectId)
    const projet = await this.repo.findById(id)

    if (!projet) {
      throw new ProjectNotFoundError(projectId)
    }

    // Acquire advisory lock if lock manager is provided
    if (this.lockManager) {
      await this.lockManager.acquireLock(projectId)
    }

    return projet
  }
}
