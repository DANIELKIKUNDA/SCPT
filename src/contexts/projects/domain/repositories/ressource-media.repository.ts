import type { RessourceMedia } from '../aggregates/ressource-media'
import type { RessourceMediaId } from '../value-objects/ressource-media-id'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface RessourceMediaRepository {
  save(media: RessourceMedia): Promise<void>
  findById(id: RessourceMediaId): Promise<RessourceMedia | null>
  findAll(projetId: ProjetAudiovisuelId): Promise<RessourceMedia[]>
  findByChecksum(projetId: ProjetAudiovisuelId, checksum: string): Promise<RessourceMedia | null>
  delete(id: RessourceMediaId): Promise<void>
}