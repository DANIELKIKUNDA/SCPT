import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { synchronizeTextToDuration } from '../../services/subtitle-synchronizer'
import { GetSubtitleTrackUseCase } from './get-subtitle-track.use-case'

export class SynchronizeSubtitlesUseCase {
  constructor(
    private readonly repository: PisteSousTitresRepository,
    private readonly narrationRepository: PisteNarrationRepository
  ) {}

  async execute(projectId: string, langue: string) {
    const narration = await this.narrationRepository.findByProject(ProjetAudiovisuelId.from(projectId))
    if (!narration) throw new Error('Narration track not found')
    const finalTake = narration.priseFinale
    if (!finalTake) throw new Error('FINAL_NARRATION_REQUIRED')
    if (!finalTake.texte.trim()) throw new Error('SUBTITLE_SOURCE_TEXT_EMPTY')

    const track = await new GetSubtitleTrackUseCase(this.repository).execute(
      langue,
      narration.versionTexte.value
    )
    const segments = synchronizeTextToDuration(finalTake.texte, finalTake.dureeMs)
    const updated = track.synchronize(segments, narration.versionTexte)
    await this.repository.save(updated)
    return updated
  }
}
