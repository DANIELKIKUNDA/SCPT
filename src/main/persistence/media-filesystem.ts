/**
 * Phase 4 — Filesystem operations for media import.
 * All filesystem access is isolated here (called from use cases via IPC).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, copyFileSync, mkdirSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import sanitize from 'sanitize-filename'

export interface MediaFileInfo {
  /** Full path to the imported file in the project media directory */
  destPath: string
  /** Relative POSIX path from project root */
  cheminRelatif: string
  /** SHA-256 hex digest */
  checksum: string
  /** File size in bytes */
  tailleOctets: number
  /** Detected MIME type from content */
  mimeType: string
  /** Original filename provided by user */
  nomOriginal: string
}

/**
 * Compute SHA-256 of a file.
 */
export function computeChecksum(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

/**
 * Find a safe destination filename. Never overwrites.
 * If `image.jpg` exists → `image-1.jpg`
 */
export function safeDestPath(mediaDir: string, originalName: string): { destPath: string; safeName: string } {
  const safeName = sanitize(basename(originalName))
  let dest = join(mediaDir, safeName)
  if (!existsSync(dest)) return { destPath: dest, safeName }

  const ext = extname(safeName)
  const base = basename(safeName, ext)
  let counter = 1
  while (existsSync(dest)) {
    dest = join(mediaDir, `${base}-${counter}${ext}`)
    counter++
  }
  return { destPath: dest, safeName }
}

/**
 * Import a media file from a source path into the project's media directory.
 * Returns metadata about the imported file.
 */
export function importMediaFile(
  sourcePath: string,
  projectMediaDir: string,
  detectedMimeType: string
): MediaFileInfo {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`)
  }

  // Ensure media directory exists
  if (!existsSync(projectMediaDir)) {
    mkdirSync(projectMediaDir, { recursive: true })
  }

  const checksum = computeChecksum(sourcePath)
  const stats = statSync(sourcePath)
  const nomOriginal = basename(sourcePath)

  const { destPath, safeName } = safeDestPath(projectMediaDir, nomOriginal)

  // Copy the file (preserves source)
  copyFileSync(sourcePath, destPath)

  // Compute relative POSIX path
  const cheminRelatif = 'media/source/' + safeName

  return {
    destPath,
    cheminRelatif,
    checksum,
    tailleOctets: stats.size,
    mimeType: detectedMimeType,
    nomOriginal
  }
}

/**
 * Verify source file has not been modified (compare checksum).
 */
export function verifySourceIntegrity(sourcePath: string, expectedChecksum: string): boolean {
  if (!existsSync(sourcePath)) return false
  try {
    return computeChecksum(sourcePath) === expectedChecksum
  } catch {
    return false
  }
}

/**
 * Build the project media directory path from the project directory.
 */
export function getProjectMediaDir(projectDir: string): string {
  return join(projectDir, 'media', 'source')
}