import type { ProjetAudiovisuel } from '../../domain/aggregates/projet-audiovisuel'
import type { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'

export class InMemoryProjetAudiovisuelRepository implements ProjetAudiovisuelRepository {
  private readonly projects: Map<string, ProjetAudiovisuel> = new Map()

  async save(projet: ProjetAudiovisuel): Promise<void> {
    this.projects.set(projet.id.value, projet)
  }

  async findById(id: ProjetAudiovisuelId): Promise<ProjetAudiovisuel | null> {
    return this.projects.get(id.value) ?? null
  }

  async findAll(): Promise<ProjetAudiovisuel[]> {
    return Array.from(this.projects.values())
  }

  async findRecent(limit: number): Promise<ProjetAudiovisuel[]> {
    return Array.from(this.projects.values())
      .filter((p) => !p.isArchived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
  }

  async findArchived(): Promise<ProjetAudiovisuel[]> {
    return Array.from(this.projects.values())
      .filter((p) => p.isArchived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  async delete(id: ProjetAudiovisuelId): Promise<void> {
    this.projects.delete(id.value)
  }

  clear(): void {
    this.projects.clear()
  }
}