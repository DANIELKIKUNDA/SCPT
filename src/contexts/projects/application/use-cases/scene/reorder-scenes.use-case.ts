import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { SceneId } from '../../../domain/value-objects/scene-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class ReorderScenesUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(projetId: string, orderedSceneIds: string[]): Promise<void> {
    const pid = ProjetAudiovisuelId.from(projetId)
    const ids = orderedSceneIds.map(id => SceneId.from(id))
    await this.repo.reorder(pid, ids)
  }
}