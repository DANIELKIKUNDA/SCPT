import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import { Scene } from '../../../domain/aggregates/scene'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { SceneType } from '../../../domain/value-objects/scene-type'

export class CreateSceneUseCase {
  constructor(private readonly repo: SequenceSceneRepository) {}

  async execute(input: {
    projetId: string
    type: string
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
  }): Promise<Scene> {
    const projetId = ProjetAudiovisuelId.from(input.projetId)
    const ordre = await this.repo.nextOrdre(projetId)

    const scene = Scene.create({
      projetId,
      ordre,
      type: input.type as SceneType,
      titre: input.titre ?? null,
      narrationTexte: input.narrationTexte ?? null,
      texteAffiche: input.texteAffiche ?? null,
      dureeMs: input.dureeMs
    })

    await this.repo.save(scene)
    return scene
  }
}