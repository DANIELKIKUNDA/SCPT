import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'
import type { ProjetAudiovisuel } from '../../domain/aggregates/projet-audiovisuel'

export class ListRecentUseCase {
  constructor(private readonly repo: ProjetAudiovisuelRepository) {}

  async execute(limit: number = 10): Promise<ProjetAudiovisuel[]> {
    return this.repo.findRecent(limit)
  }
}