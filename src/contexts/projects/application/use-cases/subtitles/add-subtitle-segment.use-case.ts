import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import type { SegmentSousTitre } from '../../../domain/aggregates/piste-sous-titres'

export class AddSubtitleSegmentUseCase {
  constructor(private readonly repository: PisteSousTitresRepository) {}

  async execute(segment: Omit<SegmentSousTitre, 'id' | 'ordre'>) {
    const track = await this.repository.findMaster()
    if (!track) throw new Error('Subtitle track not found')
    const updated = track.addSegment(segment)
    await this.repository.save(updated)
    return updated
  }
}
