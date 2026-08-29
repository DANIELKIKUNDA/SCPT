import { PisteSousTitres } from '../../../domain/aggregates/piste-sous-titres'
import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import { VersionMetier } from '../../../domain/value-objects/version-metier'

export class GetSubtitleTrackUseCase {
  constructor(private readonly repository: PisteSousTitresRepository) {}

  async execute(langue: string, narrationVersion: number): Promise<PisteSousTitres> {
    const version = VersionMetier.from(narrationVersion)
    const existing = await this.repository.findMaster()
    if (existing) {
      if (!existing.versionNarration.equals(version)) {
        if (existing.segments.length > 0) {
          const stale = existing.markResyncNeeded()
          await this.repository.save(stale)
          return stale
        }

        // An empty track has no authored timing to invalidate. Align its source
        // version immediately so a later manual segment cannot accidentally be
        // validated against an obsolete narration version.
        const aligned = existing.synchronize([], version)
        await this.repository.save(aligned)
        return aligned
      }
      return existing
    }
    const created = PisteSousTitres.create({ langue, versionNarration: version })
    await this.repository.save(created)
    return created
  }
}
