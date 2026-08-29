import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'
import { ExportAudiovisuel } from '../../../domain/aggregates/export-audiovisuel'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

export class RequestRenderUseCase {
  constructor(
    private readonly exports: ExportAudiovisuelRepository,
    private readonly declinaisons: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersions: ProjectSourceVersionPort
  ) {}

  async execute(input: { projectId: string; declinaisonId: string }): Promise<ExportAudiovisuel> {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const declinaisonId = DeclinaisonId.from(input.declinaisonId)
    const declinaison = await this.declinaisons.findById(declinaisonId)
    if (!declinaison || declinaison.projetId.value !== projectId.value) throw new Error('RENDER_DECLINATION_NOT_FOUND')
    if (declinaison.isObsolete) throw new Error('RENDER_DECLINATION_OBSOLETE')
    if (!declinaison.isReadyForRender) throw new Error('RENDER_DECLINATION_NOT_READY')

    const currentSourceVersion = await this.sourceVersions.current(projectId)
    if (!declinaison.versionProjetSource.equals(currentSourceVersion)) throw new Error('RENDER_SOURCE_OBSOLETE')

    const active = await this.exports.findActiveByDeclinaison(declinaisonId)
    if (active) throw new Error('RENDER_ALREADY_ACTIVE')

    const tentative = (await this.exports.maxAttemptForDeclinaison(declinaisonId)) + 1
    const job = ExportAudiovisuel.request({
      projetId: projectId,
      declinaisonId,
      tentative,
      profil: declinaison.profilExport,
      versionsSources: {
        versionProjetSource: currentSourceVersion,
        versionDeclinaison: declinaison.version
      }
    }).enqueue()
    await this.exports.save(job)
    return job
  }
}
