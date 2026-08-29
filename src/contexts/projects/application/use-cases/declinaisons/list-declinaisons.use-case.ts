import type { DeclinaisonAudiovisuelle } from '../../../domain/aggregates/declinaison-audiovisuelle'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export interface ListedDeclinaison {
  declinaison: DeclinaisonAudiovisuelle
  currentSourceVersion: number
}

export class ListDeclinaisonsUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(projectIdValue: string): Promise<ListedDeclinaison[]> {
    const projectId = ProjetAudiovisuelId.from(projectIdValue)
    const current = await this.sourceVersion.current(projectId)
    const all = await this.repository.findAllByProject(projectId)
    const result: ListedDeclinaison[] = []
    for (const declinaison of all) {
      const checked = declinaison.markObsoleteIfSourceChanged(current)
      if (checked.statut !== declinaison.statut) await this.repository.save(checked)
      result.push({ declinaison: checked, currentSourceVersion: current.value })
    }
    return result
  }
}
