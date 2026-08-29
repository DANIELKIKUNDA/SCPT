import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'

export class MarkSubtitlesResyncUseCase {
  constructor(private readonly repository: PisteSousTitresRepository) {}

  async execute(): Promise<void> {
    const track = await this.repository.findMaster()
    if (!track) return
    const updated = track.markResyncNeeded()
    if (updated.statut !== track.statut) await this.repository.save(updated)
  }
}
