import { PisteNarration } from '../../../domain/aggregates/piste-narration'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class GetNarrationTrackUseCase {
  constructor(private readonly repository: PisteNarrationRepository) {}

  async execute(projectId: string, langue: string): Promise<PisteNarration> {
    const projetId = ProjetAudiovisuelId.from(projectId)
    const existing = await this.repository.findByProject(projetId)
    if (existing) return existing
    const created = PisteNarration.create({ projetId, langue })
    await this.repository.save(created)
    return created
  }
}
