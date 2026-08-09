import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { Scene } from '../../../domain/aggregates/scene'
import { SceneId } from '../../../domain/value-objects/scene-id'

export class UpdateSceneUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(input: {
    sceneId: string
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
  }): Promise<Scene> {
    const id = SceneId.from(input.sceneId)
    const existing = await this.repo.findById(id)
    if (!existing) throw new Error(`Scene not found: ${input.sceneId}`)

    const updated = existing.update({
      titre: input.titre !== undefined ? input.titre : undefined,
      narrationTexte: input.narrationTexte !== undefined ? input.narrationTexte : undefined,
      texteAffiche: input.texteAffiche !== undefined ? input.texteAffiche : undefined,
      dureeMs: input.dureeMs
    })

    await this.repo.save(updated)
    return updated
  }
}