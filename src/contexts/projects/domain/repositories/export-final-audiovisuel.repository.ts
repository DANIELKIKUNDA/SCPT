import type { ExportFinalAudiovisuel, ExportFinalStatus } from '../aggregates/export-final-audiovisuel'
import type { ExportId } from '../value-objects/export-id'
import type { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export interface ExportFinalAudiovisuelRepository {
  save(value: ExportFinalAudiovisuel): Promise<void>
  findById(id: ExportId): Promise<ExportFinalAudiovisuel | null>
  findAllByProject(projectId: ProjetAudiovisuelId): Promise<ExportFinalAudiovisuel[]>
  findActiveByRenderJob(renderJobId: ExportId): Promise<ExportFinalAudiovisuel | null>
  findByStatuses(projectId: ProjetAudiovisuelId, statuses: ExportFinalStatus[]): Promise<ExportFinalAudiovisuel[]>
  maxAttemptForRenderJob(renderJobId: ExportId): Promise<number>
}
