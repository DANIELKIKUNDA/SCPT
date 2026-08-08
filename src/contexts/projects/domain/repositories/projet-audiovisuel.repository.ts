import type { ProjetAudiovisuel } from '../aggregates/projet-audiovisuel'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface ProjetAudiovisuelRepository {
  save(projet: ProjetAudiovisuel): Promise<void>
  findById(id: ProjetAudiovisuelId): Promise<ProjetAudiovisuel | null>
  findAll(): Promise<ProjetAudiovisuel[]>
  findRecent(limit: number): Promise<ProjetAudiovisuel[]>
  findArchived(): Promise<ProjetAudiovisuel[]>
  delete(id: ProjetAudiovisuelId): Promise<void>
}