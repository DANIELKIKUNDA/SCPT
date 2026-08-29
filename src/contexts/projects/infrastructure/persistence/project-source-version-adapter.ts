import type { ProjectSourceVersionPort } from '../../application/ports/project-source-version.port'
import type { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { createProjectSourceSnapshotService } from './project-source-snapshot'

export function createProjectSourceVersionAdapter(dbPath: string): ProjectSourceVersionPort & { close(): void } {
  const service = createProjectSourceSnapshotService(dbPath)
  return {
    current(projectId: ProjetAudiovisuelId) {
      return service.current(projectId).version
    },
    close(): void {
      service.close()
    }
  }
}
