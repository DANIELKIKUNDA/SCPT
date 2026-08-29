import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { SequenceSceneRepository } from '../../../domain/repositories/sequence-scene.repository'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export class ValidateDeclinaisonUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sceneRepository: SequenceSceneRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(input: { projectId: string; declinaisonId: string }) {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const declinaison = await this.repository.findById(DeclinaisonId.from(input.declinaisonId))
    if (!declinaison || !declinaison.projetId.equals(projectId)) throw new Error('Declination not found')
    const currentVersion = await this.sourceVersion.current(projectId)
    const scenes = await this.sceneRepository.loadSequence(projectId)
    if (scenes.length === 0) throw new Error('DECLINATION_EMPTY_PROJECT')
    const reviewed = declinaison.sendToReview(currentVersion, scenes.map((scene) => scene.id.value))
    const validated = reviewed.validate(currentVersion, scenes.map((scene) => scene.id.value))
    await this.repository.save(validated)
    return validated
  }
}
