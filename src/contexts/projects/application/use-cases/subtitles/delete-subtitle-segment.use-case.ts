import type { PisteSousTitresRepository } from '../../../domain/repositories/piste-sous-titres.repository'

export class DeleteSubtitleSegmentUseCase {
  constructor(private readonly repository: PisteSousTitresRepository) {}

  async execute(segmentId: string) {
    const track = await this.repository.findMaster()
    if (!track) throw new Error('Subtitle track not found')
    const updated = track.deleteSegment(segmentId)
    await this.repository.save(updated)
    return updated
  }
}
