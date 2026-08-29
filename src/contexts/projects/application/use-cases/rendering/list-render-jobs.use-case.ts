import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class ListRenderJobsUseCase {
  constructor(private readonly exports: ExportAudiovisuelRepository) {}

  execute(projectId: string) {
    return this.exports.findAllByProject(ProjetAudiovisuelId.from(projectId))
  }
}
