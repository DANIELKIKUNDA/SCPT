import { existsSync } from 'node:fs'
import type { ProjectSourceVersionPort } from '../../application/ports/project-source-version.port'
import type { InspectionMediaPort } from '../../application/ports/inspection-media.port'
import type { ExportFinalAudiovisuel } from '../../domain/aggregates/export-final-audiovisuel'
import type { DeclinaisonAudiovisuelleRepository } from '../../domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../domain/repositories/export-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../domain/repositories/piste-narration.repository'
import { FinalExportFilesystem } from './final-export-filesystem'

export interface FinalExportInput {
  videoInputPath: string
  audioInputPath: string
  expectedDurationMs: number
  audioDurationMs: number
  width: number
  height: number
  formatLabel: string
}

export class FinalExportInputBuilder {
  private readonly files: FinalExportFilesystem

  constructor(
    private readonly projectDir: string,
    private readonly renders: ExportAudiovisuelRepository,
    private readonly declinaisons: DeclinaisonAudiovisuelleRepository,
    private readonly narrations: PisteNarrationRepository,
    private readonly sourceVersions: ProjectSourceVersionPort,
    private readonly inspector: InspectionMediaPort
  ) {
    this.files = new FinalExportFilesystem(projectDir)
  }

  async build(exportFinal: ExportFinalAudiovisuel, signal?: AbortSignal): Promise<FinalExportInput> {
    const renderJob = await this.renders.findById(exportFinal.renderJobId)
    if (!renderJob || renderJob.projetId.value !== exportFinal.projetId.value) throw new Error('FINAL_EXPORT_RENDER_NOT_FOUND')
    if (renderJob.statut !== 'termine' || !renderJob.cheminFichier || !renderJob.checksum) {
      throw new Error('FINAL_EXPORT_RENDER_NOT_READY')
    }
    if (renderJob.checksum.toLowerCase() !== exportFinal.sourceRenderChecksum.toLowerCase()) {
      throw new Error('FINAL_EXPORT_RENDER_CHANGED')
    }

    const currentSource = await this.sourceVersions.current(exportFinal.projetId)
    if (!renderJob.versionsSources.versionProjetSource.equals(currentSource)) throw new Error('FINAL_EXPORT_SOURCE_OBSOLETE')

    const declinaison = await this.declinaisons.findById(exportFinal.declinaisonId)
    if (!declinaison || declinaison.projetId.value !== exportFinal.projetId.value) throw new Error('FINAL_EXPORT_DECLINATION_NOT_FOUND')
    if (declinaison.isObsolete) throw new Error('FINAL_EXPORT_DECLINATION_OBSOLETE')

    const narration = await this.narrations.findByProject(exportFinal.projetId)
    const finalTake = narration?.priseFinale ?? null
    if (!narration || narration.statut !== 'validee' || !finalTake) throw new Error('FINAL_EXPORT_AUDIO_MISSING')
    if (finalTake.id !== exportFinal.narrationTakeId || finalTake.checksum.toLowerCase() !== exportFinal.narrationChecksum.toLowerCase()) {
      throw new Error('FINAL_EXPORT_NARRATION_CHANGED')
    }

    const videoInputPath = this.files.absoluteFromRelative(renderJob.cheminFichier)
    const audioInputPath = this.files.absoluteFromRelative(finalTake.fichierAudio)
    if (!existsSync(videoInputPath)) throw new Error('FINAL_EXPORT_VIDEO_MISSING')
    if (!existsSync(audioInputPath)) throw new Error('FINAL_EXPORT_AUDIO_MISSING')
    await Promise.all([
      this.files.verifyChecksum(videoInputPath, exportFinal.sourceRenderChecksum),
      this.files.verifyChecksum(audioInputPath, exportFinal.narrationChecksum)
    ])

    const [videoInspection, audioInspection] = await Promise.all([
      this.inspector.inspect(videoInputPath, signal),
      this.inspector.inspect(audioInputPath, signal)
    ])
    const videoStream = videoInspection.streams.find((stream) => stream.codecType === 'video')
    const audioStream = audioInspection.streams.find((stream) => stream.codecType === 'audio')
    if (!videoStream) throw new Error('FINAL_EXPORT_VIDEO_STREAM_MISSING')
    if (!audioStream) throw new Error('FINAL_EXPORT_AUDIO_STREAM_MISSING')
    if (videoStream.width !== declinaison.resolution.width || videoStream.height !== declinaison.resolution.height) {
      throw new Error('FINAL_EXPORT_SOURCE_RESOLUTION_MISMATCH')
    }

    const expectedDurationMs = videoInspection.durationMs
    const audioDurationMs = audioInspection.durationMs
    const audioTooLong = audioDurationMs > expectedDurationMs + 500
    const allowedShortfall = Math.max(2000, Math.round(expectedDurationMs * 0.1))
    const audioTooShort = expectedDurationMs - audioDurationMs > allowedShortfall
    if (audioTooLong || audioTooShort) throw new Error('FINAL_EXPORT_DURATION_MISMATCH')

    return {
      videoInputPath,
      audioInputPath,
      expectedDurationMs,
      audioDurationMs,
      width: declinaison.resolution.width,
      height: declinaison.resolution.height,
      formatLabel: declinaison.format.label.replace(':', 'x')
    }
  }
}
