import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'
import { ExportFinalAudiovisuel } from '../../../domain/aggregates/export-final-audiovisuel'
import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import type { ExportFinalAudiovisuelRepository } from '../../../domain/repositories/export-final-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { RessourceMediaRepository } from '../../../domain/repositories/ressource-media.repository'
import { ExportId } from '../../../domain/value-objects/export-id'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

const ALLOWED_RIGHTS = new Set(['originale', 'autorisee', 'libre'])

export class RequestFinalExportUseCase {
  constructor(
    private readonly finalExports: ExportFinalAudiovisuelRepository,
    private readonly renders: ExportAudiovisuelRepository,
    private readonly narrations: PisteNarrationRepository,
    private readonly medias: RessourceMediaRepository,
    private readonly sourceVersions: ProjectSourceVersionPort
  ) {}

  async execute(input: { projectId: string; renderJobId: string }): Promise<ExportFinalAudiovisuel> {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const renderJobId = ExportId.from(input.renderJobId)
    const renderJob = await this.renders.findById(renderJobId)
    if (!renderJob || renderJob.projetId.value !== projectId.value) throw new Error('FINAL_EXPORT_RENDER_NOT_FOUND')
    if (renderJob.statut !== 'termine' || !renderJob.cheminFichier || !renderJob.checksum) {
      throw new Error('FINAL_EXPORT_RENDER_NOT_READY')
    }

    const currentSourceVersion = await this.sourceVersions.current(projectId)
    if (!renderJob.versionsSources.versionProjetSource.equals(currentSourceVersion)) {
      throw new Error('FINAL_EXPORT_SOURCE_OBSOLETE')
    }

    const active = await this.finalExports.findActiveByRenderJob(renderJobId)
    if (active) throw new Error('FINAL_EXPORT_ALREADY_ACTIVE')

    const narration = await this.narrations.findByProject(projectId)
    const finalTake = narration?.priseFinale ?? null
    if (!narration || narration.statut !== 'validee' || !finalTake) throw new Error('FINAL_EXPORT_AUDIO_MISSING')

    const medias = await this.medias.findAll(projectId)
    const blocked = medias.find((media) => !ALLOWED_RIGHTS.has(media.droits))
    if (blocked) {
      throw new Error(blocked.droits === 'interdite' ? 'FINAL_EXPORT_MEDIA_FORBIDDEN' : 'FINAL_EXPORT_MEDIA_RIGHTS_UNKNOWN')
    }
    const unavailable = medias.find((media) => !media.isDisponible)
    if (unavailable) throw new Error('FINAL_EXPORT_MEDIA_UNAVAILABLE')

    const tentative = (await this.finalExports.maxAttemptForRenderJob(renderJobId)) + 1
    const exportFinal = ExportFinalAudiovisuel.request({
      projetId: projectId,
      renderJobId,
      declinaisonId: renderJob.declinaisonId,
      tentative,
      profil: renderJob.profil,
      sourceRenderChecksum: renderJob.checksum,
      narrationTakeId: finalTake.id,
      narrationChecksum: finalTake.checksum
    }).enqueue()
    await this.finalExports.save(exportFinal)
    return exportFinal
  }
}
