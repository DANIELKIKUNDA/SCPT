import type { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import type { VersionMetier } from '../../domain/value-objects/version-metier'

export interface ProjectSourceVersionPort {
  current(projectId: ProjetAudiovisuelId): Promise<VersionMetier> | VersionMetier
}
