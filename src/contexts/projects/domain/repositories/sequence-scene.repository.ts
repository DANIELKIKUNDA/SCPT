import type { Scene } from '../aggregates/scene'
import type { SceneId } from '../value-objects/scene-id'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface SequenceSceneRepository {
  /** Load all scenes for a project, ordered by ordre ASC */
  loadSequence(projetId: ProjetAudiovisuelId): Promise<Scene[]>

  /** Save a scene (insert or update) */
  save(scene: Scene): Promise<void>

  /** Find a scene by ID */
  findById(id: SceneId): Promise<Scene | null>

  /** Duplicate a scene, returning the new scene with the next available order */
  duplicate(id: SceneId): Promise<Scene>

  /** Delete a scene and re-compact the order sequence */
  delete(id: SceneId): Promise<void>

  /**
   * Atomically reorder scenes.
   * @param orderedIds scene IDs in the new desired order
   */
  reorder(projectId: ProjetAudiovisuelId, orderedIds: SceneId[]): Promise<void>

  /** Get the next available order number for a project */
  nextOrdre(projetId: ProjetAudiovisuelId): Promise<number>
}