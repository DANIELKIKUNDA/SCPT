import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import { ExportId } from '../../../domain/value-objects/export-id'

export class RetryRenderUseCase {
  constructor(
    private readonly exports: ExportAudiovisuelRepository,
    private readonly declinaisons: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersions: ProjectSourceVersionPort
  ) {}

  async execute(jobId: string) {
    const job = await this.exports.findById(ExportId.from(jobId))
    if (!job) throw new Error('RENDER_JOB_NOT_FOUND')
    const declinaison = await this.declinaisons.findById(job.declinaisonId)
    if (!declinaison) throw new Error('RENDER_DECLINATION_NOT_FOUND')
    if (declinaison.isObsolete || !declinaison.isReadyForRender) throw new Error('RENDER_DECLINATION_NOT_READY')
    const sourceVersion = await this.sourceVersions.current(job.projetId)
    if (!declinaison.versionProjetSource.equals(sourceVersion)) throw new Error('RENDER_SOURCE_OBSOLETE')
    const active = await this.exports.findActiveByDeclinaison(job.declinaisonId)
    if (active && active.id.value !== job.id.value) throw new Error('RENDER_ALREADY_ACTIVE')

    const retried = job.retry({
      versionProjetSource: sourceVersion,
      versionDeclinaison: declinaison.version
    }).enqueue()
    await this.exports.save(retried)
    return retried
  }
}
