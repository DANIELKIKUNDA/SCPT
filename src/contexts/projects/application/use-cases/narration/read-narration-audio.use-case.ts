import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import type { NarrationAudioPort } from '../../ports/narration-audio.port'

export class ReadNarrationAudioUseCase {
  constructor(
    private readonly repository: PisteNarrationRepository,
    private readonly audio: NarrationAudioPort
  ) {}

  async execute(projectId: string, takeId: string): Promise<{ base64: string; mimeType: string }> {
    const track = await this.repository.findByProject(ProjetAudiovisuelId.from(projectId))
    if (!track) throw new Error('Narration track not found')
    const take = track.segments.find((segment) => segment.id === takeId)
    if (!take) throw new Error('Narration take not found')
    return this.audio.readBase64(take.fichierAudio)
  }
}
