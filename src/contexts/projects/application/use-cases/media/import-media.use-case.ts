import type { RessourceMediaRepository } from '../../../domain/repositories/ressource-media.repository'
import { RessourceMedia } from '../../../domain/aggregates/ressource-media'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export interface ImportMediaInput {
  projetId: string
  mimeType: string
  type: string
  checksum: string
  cheminRelatif: string
  nomOriginal: string
  tailleOctets: number
  largeur?: number | null
  hauteur?: number | null
  dureeMs?: number | null
}

export class ImportMediaUseCase {
  constructor(private readonly repo: RessourceMediaRepository) {}

  async execute(input: ImportMediaInput): Promise<RessourceMedia> {
    const projetId = ProjetAudiovisuelId.from(input.projetId)

    const existing = await this.repo.findByChecksum(projetId, input.checksum)
    if (existing) return existing

    const media = RessourceMedia.create({
      projetId,
      type: input.type,
      cheminRelatif: input.cheminRelatif,
      nomOriginal: input.nomOriginal,
      checksum: input.checksum,
      tailleOctets: input.tailleOctets,
      mimeType: input.mimeType,
      largeur: input.largeur ?? null,
      hauteur: input.hauteur ?? null,
      dureeMs: input.dureeMs ?? null,
      statut: 'disponible'
    })

    await this.repo.save(media)
    return media
  }
}