/**
 * Phase 4 — Media import IPC handler.
 * Detects file type, computes checksum, copies file, extracts metadata,
 * generates thumbnails, and persists the RessourceMedia record.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, copyFileSync, mkdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { app } from 'electron'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import { safeDestPath, getProjectMediaDir } from '../persistence/media-filesystem'

export interface MediaImportResult {
  id: string
  type: string
  cheminRelatif: string
  nomOriginal: string
  checksum: string
  tailleOctets: number
  mimeType: string
  largeur: number | null
  hauteur: number | null
  dureeMs: number | null
  statut: string
  thumbnailPath: string | null
}

/**
 * Full import pipeline for a media file.
 * @param sourcePath - absolute path to the user's file
 * @param projectId - ULID of the target project
 * @returns MediaImportResult with metadata and thumbnail path
 */
export async function executeMediaImport(
  sourcePath: string,
  projectId: string
): Promise<MediaImportResult> {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`)
  }

  // 1. Detect real type (never trust extension)
  const buffer = readFileSync(sourcePath)
  const typeResult = await fileTypeFromBuffer(buffer)
  if (!typeResult) {
    throw new Error('Could not detect file type from content')
  }

  // Map MIME to media type
  const mediaType = mapMimeToMediaType(typeResult.mime)

  // 2. Compute checksum
  const checksum = createHash('sha256').update(buffer).digest('hex')

  // 3. Prepare destination
  const projectsDir = join(app.getPath('userData'), 'projects')
  const projectDir = join(projectsDir, projectId)
  const mediaDir = getProjectMediaDir(projectDir)
  const { destPath, safeName } = safeDestPath(mediaDir, typeResult.ext ? `import.${typeResult.ext}` : 'import.bin')

  // 4. Copy file (preserve source)
  if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })
  copyFileSync(sourcePath, destPath)

  const stats = statSync(destPath)
  const cheminRelatif = 'media/source/' + safeName

  // 5. Extract metadata (images)
  let largeur: number | null = null
  let hauteur: number | null = null
  let thumbnailPath: string | null = null

  if (['image', 'logo'].includes(mediaType)) {
    try {
      const meta = await sharp(destPath).metadata()
      largeur = meta.width ?? null
      hauteur = meta.height ?? null

      // 6. Generate thumbnail
      const thumbDir = join(mediaDir, '..', 'thumbnails')
      if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true })
      const thumbDest = join(thumbDir, safeName.replace(/\.\w+$/, '_thumb.jpg'))
      await sharp(destPath).resize(256, 256, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(thumbDest)
      thumbnailPath = thumbDest
    } catch (err) {
      // Thumbnail failure must not destroy the source
      console.error('Thumbnail generation failed:', err)
    }
  }

  // Build result
  return {
    id: '', // will be set by caller after persistence
    type: mediaType,
    cheminRelatif,
    nomOriginal: basename(sourcePath),
    checksum,
    tailleOctets: stats.size,
    mimeType: typeResult.mime,
    largeur,
    hauteur,
    dureeMs: null,
    statut: 'disponible',
    thumbnailPath
  }
}

function mapMimeToMediaType(mime: string): string {
  if (mime.startsWith('image/')) {
    if (mime.includes('svg') || mime.includes('icon')) return 'logo'
    return 'image'
  }
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}