import { z } from 'zod'
import { ProjetAudiovisuel } from '../../domain/aggregates/projet-audiovisuel'
import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'

export const CreateProjectInputSchema = z.object({
  titre: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  objectif: z.string().min(1).max(2000),
  publicCible: z.string().min(1).max(200),
  langueSource: z.string().min(1).max(10)
})

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>

export class CreateProjectUseCase {
  constructor(private readonly repo: ProjetAudiovisuelRepository) {}

  async execute(input: unknown): Promise<ProjetAudiovisuel> {
    const parsed = CreateProjectInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new Error(`Données invalides: ${parsed.error.issues.map((i) => i.message).join(', ')}`)
    }

    const projet = ProjetAudiovisuel.create(parsed.data)
    await this.repo.save(projet)
    return projet
  }
}