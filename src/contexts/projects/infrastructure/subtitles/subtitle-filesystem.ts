import { basename, dirname, join, relative, resolve, sep } from 'path'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import type { SubtitleFilePort, SubtitleExportResult } from '../../application/ports/subtitle-file.port'
import type { SubtitleExportFormat } from '../../application/services/subtitle-format'

function toPosix(value: string): string {
  return value.split(sep).join('/')
}

export class SubtitleFilesystem implements SubtitleFilePort {
  private readonly projectDirResolved: string

  constructor(private readonly projectDir: string) {
    this.projectDirResolved = resolve(projectDir)
  }

  async exportText(input: {
    langue: string
    format: SubtitleExportFormat
    content: string
    destinationPath: string
  }): Promise<SubtitleExportResult> {
    const language = input.langue.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'fr'
    const canonicalDir = join(this.projectDirResolved, 'subtitles', language)
    const canonicalPath = join(canonicalDir, `master.${input.format}`)
    await mkdir(canonicalDir, { recursive: true })
    await writeFile(canonicalPath, input.content, 'utf8')

    const destination = resolve(input.destinationPath)
    await mkdir(dirname(destination), { recursive: true })
    if (destination !== canonicalPath) await copyFile(canonicalPath, destination)

    const relativePath = relative(this.projectDirResolved, canonicalPath)
    if (relativePath.startsWith('..') || resolve(this.projectDirResolved, relativePath) !== canonicalPath) {
      throw new Error('Subtitle export escaped the project directory')
    }

    return {
      relativeProjectPath: toPosix(relativePath),
      fileName: basename(destination)
    }
  }
}
