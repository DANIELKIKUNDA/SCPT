import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'
import type { SegmentSousTitre } from '../../../domain/aggregates/piste-sous-titres'

export class UpdateSubtitleSegmentUseCase {
  constructor(private readonly repository: PisteSousTitresRepository) {}

  async execute(
    segmentId: string,
    patch: Partial<Pick<SegmentSousTitre, 'debutMs' | 'finMs' | 'texte' | 'position' | 'style'>>
  ) {
    const track = await this.repository.findMaster()
    if (!track) throw new Error('Subtitle track not found')
    const updated = track.updateSegment(segmentId, patch)
    await this.repository.save(updated)
    return updated
  }
}
