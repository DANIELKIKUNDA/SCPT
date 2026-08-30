import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface SessionMarker {
  sessionId: string
  projectId: string
  pid: number
  openedAt: string
}

export class RecoverySessionService {
  constructor(private readonly projectDir: string) {}

  private get markerPath(): string {
    return join(this.projectDir, 'recovery', 'active-session.json')
  }

  async detectPreviousCrash(projectId: string): Promise<boolean> {
    try {
      const raw = JSON.parse(await readFile(this.markerPath, 'utf-8')) as Partial<SessionMarker>
      return raw.projectId === projectId && typeof raw.openedAt === 'string'
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      return true
    }
  }

  async markOpen(projectId: string): Promise<void> {
    await mkdir(join(this.projectDir, 'recovery'), { recursive: true })
    const marker: SessionMarker = {
      sessionId: randomUUID(),
      projectId,
      pid: process.pid,
      openedAt: new Date().toISOString()
    }
    await writeFile(this.markerPath, JSON.stringify(marker, null, 2), 'utf-8')
  }

  async markCleanClose(): Promise<void> {
    await rm(this.markerPath, { force: true })
  }
}
