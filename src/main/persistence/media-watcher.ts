/**
 * Phase 4 — Media file watcher + project-open verifier.
 * Watches project media directories for changes (file deleted = mark as missing).
 * Verifies all media files exist when a project is opened.
 */
import { watch, FSWatcher } from 'chokidar'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getProjectMediaDir } from './media-filesystem'

export class MediaWatcher {
  private watchers = new Map<string, FSWatcher>()
  private onMissing: (cheminRelatif: string) => void

  constructor(onMissing: (cheminRelatif: string) => void) {
    this.onMissing = onMissing
  }

  /**
   * Start watching a project's media directory.
   */
  startWatching(projectId: string, projectDir: string): void {
    if (this.watchers.has(projectId)) return // already watching

    const mediaDir = getProjectMediaDir(projectDir)
    const watcher = watch(mediaDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0
    })

    watcher.on('unlink', (filePath: string) => {
      // Extract relative path to notify
      const relPath = 'media/source/' + filePath.split(/[\\/]/).pop()
      this.onMissing(relPath)
    })

    this.watchers.set(projectId, watcher)
  }

  /**
   * Stop watching a project.
   */
  stopWatching(projectId: string): void {
    const watcher = this.watchers.get(projectId)
    if (watcher) {
      watcher.close()
      this.watchers.delete(projectId)
    }
  }

  /**
   * Stop all watchers.
   */
  stopAll(): void {
    for (const [, w] of this.watchers) {
      w.close()
    }
    this.watchers.clear()
  }
}

/**
 * Verify all media files for a project exist on disk.
 * Returns list of cheminRelatif values for files that are missing.
 */
export function verifyMediaFiles(projectDir: string, cheminRelatifs: string[]): string[] {
  const missing: string[] = []
  for (const rel of cheminRelatifs) {
    const fullPath = join(projectDir, rel)
    if (!existsSync(fullPath)) {
      missing.push(rel)
    }
  }
  return missing
}