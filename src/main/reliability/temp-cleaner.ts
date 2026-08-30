import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface TempCleanupResult {
  removedEntries: number
  removedBytes: number
  skippedActive: number
}

async function directorySize(path: string): Promise<number> {
  try {
    const info = await stat(path)
    if (info.isFile()) return info.size
    if (!info.isDirectory()) return 0
    const entries = await readdir(path, { withFileTypes: true })
    let total = 0
    for (const entry of entries) total += await directorySize(join(path, entry.name))
    return total
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
}

export class ProjectTempCleaner {
  constructor(private readonly projectDir: string) {}

  async inspect(): Promise<{ entries: number; bytes: number }> {
    const roots = [
      join(this.projectDir, 'temp', 'rendering'),
      join(this.projectDir, 'temp', 'exporting'),
      join(this.projectDir, 'temp', 'restoring'),
      join(this.projectDir, 'audio', 'temp')
    ]
    let entries = 0
    let bytes = 0
    for (const root of roots) {
      try {
        const children = await readdir(root, { withFileTypes: true })
        for (const child of children) {
          entries++
          bytes += await directorySize(join(root, child.name))
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return { entries, bytes }
  }

  async cleanup(options?: { activeNames?: Set<string> }): Promise<TempCleanupResult> {
    const activeNames = options?.activeNames ?? new Set<string>()
    const roots = [
      join(this.projectDir, 'temp', 'rendering'),
      join(this.projectDir, 'temp', 'exporting'),
      join(this.projectDir, 'temp', 'restoring'),
      join(this.projectDir, 'audio', 'temp')
    ]
    let removedEntries = 0
    let removedBytes = 0
    let skippedActive = 0
    for (const root of roots) {
      try {
        const children = await readdir(root, { withFileTypes: true })
        for (const child of children) {
          if (activeNames.has(child.name)) {
            skippedActive++
            continue
          }
          const target = join(root, child.name)
          removedBytes += await directorySize(target)
          await rm(target, { recursive: true, force: true })
          removedEntries++
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return { removedEntries, removedBytes, skippedActive }
  }
}
