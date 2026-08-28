import type { PisteNarration } from '../../../domain/aggregates/piste-narration'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { NarrationAudioPort } from '../../ports/narration-audio.port'

export class ImportNarrationUseCase {
  constructor(
    private readonly repository: PisteNarrationRepository,
    private readonly audio: NarrationAudioPort
  ) {}

  async execute(input: {
    track: PisteNarration
    sourcePath: string
    texte?: string
    sceneId?: string | null
  }): Promise<PisteNarration> {
    const imported = await this.audio.importAudio(input.sourcePath)
    const updated = input.track.addTake({
      texte: input.texte?.trim() ?? '',
      sceneId: input.sceneId ?? null,
      fichierAudio: imported.cheminRelatif,
      dureeMs: imported.dureeMs,
      statut: 'importee',
      source: 'import',
      voixId: null,
      checksum: imported.checksum
    })
    await this.repository.save(updated)
    return updated
  }
}
