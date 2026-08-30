import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'
import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import type { ExportFinalAudiovisuelRepository } from '../../../domain/repositories/export-final-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import { ExportId } from '../../../domain/value-objects/export-id'

export class RetryFinalExportUseCase {
  constructor(
    private readonly finalExports: ExportFinalAudiovisuelRepository,
    private readonly renders: ExportAudiovisuelRepository,
    private readonly narrations: PisteNarrationRepository,
    private readonly sourceVersions: ProjectSourceVersionPort
  ) {}

  async execute(exportIdValue: string) {
    const exportId = ExportId.from(exportIdValue)
    const current = await this.finalExports.findById(exportId)
    if (!current) throw new Error('FINAL_EXPORT_NOT_FOUND')
    if (!current.canRetry) throw new Error('FINAL_EXPORT_NOT_RETRYABLE')

    const renderJob = await this.renders.findById(current.renderJobId)
    if (!renderJob || renderJob.statut !== 'termine' || !renderJob.checksum || !renderJob.cheminFichier) {
      throw new Error('FINAL_EXPORT_RENDER_NOT_READY')
    }
    const sourceVersion = await this.sourceVersions.current(current.projetId)
    if (!renderJob.versionsSources.versionProjetSource.equals(sourceVersion)) throw new Error('FINAL_EXPORT_SOURCE_OBSOLETE')

    const narration = await this.narrations.findByProject(current.projetId)
    const take = narration?.priseFinale ?? null
    if (!narration || narration.statut !== 'validee' || !take) throw new Error('FINAL_EXPORT_AUDIO_MISSING')

    const active = await this.finalExports.findActiveByRenderJob(current.renderJobId)
    if (active && active.id.value !== current.id.value) throw new Error('FINAL_EXPORT_ALREADY_ACTIVE')

    const retried = current.retry({
      sourceRenderChecksum: renderJob.checksum,
      narrationTakeId: take.id,
      narrationChecksum: take.checksum
    }).enqueue()
    await this.finalExports.save(retried)
    return retried
  }
}
