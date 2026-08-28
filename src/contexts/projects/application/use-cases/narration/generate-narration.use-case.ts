import type { PisteNarration } from '../../../domain/aggregates/piste-narration'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import type { GenerationVoixPort } from '../../ports/generation-voix.port'

export interface GenerateNarrationInput {
  track: PisteNarration
  texte: string
  voixId: string
  sceneId?: string | null
  signal?: AbortSignal
}

export class GenerateNarrationUseCase {
  constructor(
    private readonly repository: PisteNarrationRepository,
    private readonly generationVoix: GenerationVoixPort
  ) {}

  async execute(input: GenerateNarrationInput): Promise<PisteNarration> {
    const texte = input.texte.trim()
    if (!texte) throw new Error('EMPTY_TEXT')
    const generated = await this.generationVoix.generate({
      texte,
      voixId: input.voixId,
      signal: input.signal
    })
    const updated = input.track.addTake({
      texte,
      sceneId: input.sceneId ?? null,
      fichierAudio: generated.cheminRelatif,
      dureeMs: generated.dureeMs,
      statut: 'generee',
      source: 'piper',
      voixId: input.voixId,
      checksum: generated.checksum
    })
    await this.repository.save(updated)
    return updated
  }
}
