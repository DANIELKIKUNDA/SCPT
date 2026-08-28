import type { PisteNarration } from '../aggregates/piste-narration'
import type { PisteNarrationId } from '../value-objects/piste-narration-id'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface PisteNarrationRepository {
  save(track: PisteNarration): Promise<void>
  findById(id: PisteNarrationId): Promise<PisteNarration | null>
  findByProject(projetId: ProjetAudiovisuelId): Promise<PisteNarration | null>
}
