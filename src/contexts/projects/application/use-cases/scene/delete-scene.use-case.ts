import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { SceneId } from '../../../domain/value-objects/scene-id'

export class DeleteSceneUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(sceneId: string): Promise<void> {
    const id = SceneId.from(sceneId)
    const existing = await this.repo.findById(id)
    if (!existing) throw new Error(`Scene not found: ${sceneId}`)
    await this.repo.delete(id)
  }
}