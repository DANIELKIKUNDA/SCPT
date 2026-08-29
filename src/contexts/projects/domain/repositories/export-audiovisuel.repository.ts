import type { ExportAudiovisuel, ExportAudiovisuelStatus } from '../aggregates/export-audiovisuel'
import type { DeclinaisonId } from '../value-objects/declinaison-id'
import type { ExportId } from '../value-objects/export-id'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface ExportAudiovisuelRepository {
  save(exportAudiovisuel: ExportAudiovisuel): Promise<void>
  findById(id: ExportId): Promise<ExportAudiovisuel | null>
  findAllByProject(projectId: ProjetAudiovisuelId): Promise<ExportAudiovisuel[]>
  findActiveByDeclinaison(declinaisonId: DeclinaisonId): Promise<ExportAudiovisuel | null>
  findByStatuses(projectId: ProjetAudiovisuelId, statuses: ExportAudiovisuelStatus[]): Promise<ExportAudiovisuel[]>
  maxAttemptForDeclinaison(declinaisonId: DeclinaisonId): Promise<number>
}
