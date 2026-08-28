import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class SelectFinalNarrationTakeUseCase {
  constructor(private readonly repository: PisteNarrationRepository) {}

  async execute(projectId: string, takeId: string) {
    const track = await this.repository.findByProject(ProjetAudiovisuelId.from(projectId))
    if (!track) throw new Error('Narration track not found')
    const updated = track.selectFinalTake(takeId)
    await this.repository.save(updated)
    return updated
  }
}
