import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { Scene } from '../../../domain/aggregates/scene'
import { SceneId } from '../../../domain/value-objects/scene-id'

export class DuplicateSceneUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(sceneId: string): Promise<Scene> {
    const id = SceneId.from(sceneId)
    const existing = await this.repo.findById(id)
    if (!existing) throw new Error(`Scene not found: ${sceneId}`)
    return this.repo.duplicate(id)
  }
}