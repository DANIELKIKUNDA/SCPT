import type { DeclinaisonAudiovisuelle } from '../aggregates/declinaison-audiovisuelle'
import type { DeclinaisonId } from '../value-objects/declinaison-id'
import type { FormatVideo } from '../value-objects/format-video'
import type { ProfilExport } from '../value-objects/profil-export'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface DeclinaisonAudiovisuelleRepository {
  save(declinaison: DeclinaisonAudiovisuelle): Promise<void>
  findById(id: DeclinaisonId): Promise<DeclinaisonAudiovisuelle | null>
  findAllByProject(projectId: ProjetAudiovisuelId): Promise<DeclinaisonAudiovisuelle[]>
  findCurrentBySignature(input: {
    projectId: ProjetAudiovisuelId
    format: FormatVideo
    langue: string
    profilExport: ProfilExport
  }): Promise<DeclinaisonAudiovisuelle | null>
}
