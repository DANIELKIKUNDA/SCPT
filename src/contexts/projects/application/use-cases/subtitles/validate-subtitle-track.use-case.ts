import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class ValidateSubtitleTrackUseCase {
  constructor(
    private readonly repository: PisteSousTitresRepository,
    private readonly narrationRepository: PisteNarrationRepository
  ) {}

  async execute(projectId: string) {
    const track = await this.repository.findMaster()
    if (!track) throw new Error('Subtitle track not found')
    const narration = await this.narrationRepository.findByProject(ProjetAudiovisuelId.from(projectId))
    const finalTake = narration?.priseFinale
    if (!narration || !finalTake) throw new Error('FINAL_NARRATION_REQUIRED')
    if (track.segments.some((segment) => segment.finMs > finalTake.dureeMs)) {
      throw new Error('SUBTITLE_OUTSIDE_NARRATION')
    }
    const updated = track.validateAgainst(narration.versionTexte)
    await this.repository.save(updated)
    return updated
  }
}
