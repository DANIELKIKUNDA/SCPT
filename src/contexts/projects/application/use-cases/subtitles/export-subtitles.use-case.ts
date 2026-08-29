import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import type { SubtitleFilePort } from '../../ports/subtitle-file.port'
import { formatSubtitles, type SubtitleExportFormat } from '../../services/subtitle-format'

export class ExportSubtitlesUseCase {
  constructor(
    private readonly repository: PisteSousTitresRepository,
    private readonly files: SubtitleFilePort
  ) {}

  async execute(input: { format: SubtitleExportFormat; destinationPath: string }) {
    const track = await this.repository.findMaster()
    if (!track) throw new Error('Subtitle track not found')
    if (track.statut !== 'validee') throw new Error('SUBTITLE_TRACK_NOT_VALIDATED')
    const content = formatSubtitles(input.format, track.segments)
    return this.files.exportText({
      langue: track.langue,
      format: input.format,
      content,
      destinationPath: input.destinationPath
    })
  }
}
