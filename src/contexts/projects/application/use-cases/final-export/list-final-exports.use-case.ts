import type { ExportFinalAudiovisuelRepository } from '../../../domain/repositories/export-final-audiovisuel.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class ListFinalExportsUseCase {
  constructor(private readonly finalExports: ExportFinalAudiovisuelRepository) {}

  execute(projectId: string) {
    return this.finalExports.findAllByProject(ProjetAudiovisuelId.from(projectId))
  }
}
