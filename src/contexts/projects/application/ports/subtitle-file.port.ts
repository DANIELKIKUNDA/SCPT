import type { SubtitleExportFormat } from '../services/subtitle-format'

export interface SubtitleExportResult {
  relativeProjectPath: string
  fileName: string
}

export interface SubtitleFilePort {
  exportText(input: {
    langue: string
    format: SubtitleExportFormat
    content: string
    destinationPath: string
  }): Promise<SubtitleExportResult>
}
