import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import type { Scene } from '../../../domain/aggregates/scene'
import type { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class LoadSequenceUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(projetId: ProjetAudiovisuelId): Promise<Scene[]> {
    return this.repo.loadSequence(projetId)
  }
}