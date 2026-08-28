import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, rename, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { fileTypeFromFile } from 'file-type'
import { parseFile } from 'music-metadata'
import sanitizeFilename from 'sanitize-filename'
import pLimit from 'p-limit'
import type { NarrationAudioPort, ImportedNarrationAudio } from '../../application/ports/narration-audio.port'

const metadataLimit = pLimit(2)
const ALLOWED_AUDIO_MIME = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg'])
const MAX_AUDIO_BYTES = 500 * 1024 * 1024

async function checksumFile(path: string): Promise<string> {
  const buffer = await readFile(path)
  return createHash('sha256').update(buffer).digest('hex')
}

function toPosixRelative(path: string): string {
  return path.split(sep).join('/')
}

async function uniqueDestination(directory: string, requestedName: string): Promise<string> {
  const safe = sanitizeFilename(requestedName).trim() || `narration-${Date.now()}.wav`
  const ext = extname(safe)
  const base = ext ? safe.slice(0, -ext.length) : safe
  let candidate = join(directory, safe)
  let index = 1
  while (existsSync(candidate)) {
    candidate = join(directory, `${base}-${index}${ext}`)
    index += 1
  }
  return candidate
}

function assertWithinProject(projectDir: string, absolutePath: string): void {
  const root = resolve(projectDir) + sep
  const resolved = resolve(absolutePath)
  if (!resolved.startsWith(root)) {
    throw new Error('Narration path escapes the project directory')
  }
}

export class NarrationFilesystem implements NarrationAudioPort {
  constructor(private readonly projectDir: string) {}

  async ensureDirectories(): Promise<void> {
    await Promise.all([
      mkdir(join(this.projectDir, 'audio', 'narration'), { recursive: true }),
      mkdir(join(this.projectDir, 'audio', 'music'), { recursive: true }),
      mkdir(join(this.projectDir, 'audio', 'temp'), { recursive: true })
    ])
  }

  async importAudio(sourcePath: string): Promise<ImportedNarrationAudio> {
    await this.ensureDirectories()
    const sourceStat = await stat(sourcePath)
    if (!sourceStat.isFile()) throw new Error('Le fichier audio sélectionné est invalide')
    if (sourceStat.size <= 0 || sourceStat.size > MAX_AUDIO_BYTES) {
      throw new Error('Le fichier audio est vide ou trop volumineux')
    }

    const detected = await fileTypeFromFile(sourcePath)
    if (!detected || !ALLOWED_AUDIO_MIME.has(detected.mime)) {
      throw new Error('Format audio non autorisé. Utilisez WAV ou MP3.')
    }

    const metadata = await metadataLimit(() => parseFile(sourcePath))
    const durationSeconds = metadata.format.duration
    if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error('Durée audio invalide')
    }

    const narrationDir = join(this.projectDir, 'audio', 'narration')
    const destination = await uniqueDestination(narrationDir, basename(sourcePath))
    const tempDestination = `${destination}.tmp-${Date.now()}`
    await copyFile(sourcePath, tempDestination)
    try {
      const [sourceChecksum, copiedChecksum] = await Promise.all([
        checksumFile(sourcePath),
        checksumFile(tempDestination)
      ])
      if (sourceChecksum !== copiedChecksum) {
        throw new Error('La copie audio ne correspond pas à la source')
      }
      await rename(tempDestination, destination)
      return {
        cheminRelatif: toPosixRelative(destination.slice(resolve(this.projectDir).length + 1)),
        dureeMs: Math.round(durationSeconds * 1000),
        checksum: copiedChecksum,
        mimeType: detected.mime,
        nomOriginal: basename(sourcePath)
      }
    } catch (error) {
      await rm(tempDestination, { force: true })
      throw error
    }
  }

  async readBase64(cheminRelatif: string): Promise<{ base64: string; mimeType: string }> {
    if (!cheminRelatif || cheminRelatif.includes('\\')) {
      throw new Error('Chemin audio invalide')
    }
    const absolute = join(this.projectDir, ...cheminRelatif.split('/'))
    assertWithinProject(this.projectDir, absolute)
    const fileStat = await stat(absolute)
    if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > MAX_AUDIO_BYTES) {
      throw new Error('Fichier audio invalide ou trop volumineux')
    }
    const data = await readFile(absolute)
    const detected = await fileTypeFromFile(absolute)
    if (!detected || !ALLOWED_AUDIO_MIME.has(detected.mime)) {
      throw new Error('Fichier audio illisible ou non autorisé')
    }
    return { base64: data.toString('base64'), mimeType: detected.mime }
  }
}
