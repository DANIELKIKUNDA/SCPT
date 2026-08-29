import { DeclinaisonAudiovisuelle } from '../../../domain/aggregates/declinaison-audiovisuelle'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { FormatVideo } from '../../../domain/value-objects/format-video'
import { ProfilExport } from '../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { ResolutionVideo } from '../../../domain/value-objects/resolution-video'
import type { ProjectSourceVersionPort } from '../../ports/project-source-version.port'

export class CreateDeclinaisonUseCase {
  constructor(
    private readonly repository: DeclinaisonAudiovisuelleRepository,
    private readonly sourceVersion: ProjectSourceVersionPort
  ) {}

  async execute(input: {
    projectId: string
    format: string
    langue: string
    profilExport?: string
    preferredId?: string
  }): Promise<DeclinaisonAudiovisuelle> {
    const projectId = ProjetAudiovisuelId.from(input.projectId)
    const format = FormatVideo.from(input.format)
    const profilExport = ProfilExport.from(input.profilExport ?? 'MVP_PREMIUM')
    const langue = input.langue.trim()
    if (!langue) throw new Error('Declination language is required')

    const existing = await this.repository.findCurrentBySignature({
      projectId,
      format,
      langue,
      profilExport
    })
    if (existing) return existing

    const currentSourceVersion = await this.sourceVersion.current(projectId)
    let preferredId: DeclinaisonId | undefined
    if (input.preferredId) {
      const candidate = DeclinaisonId.from(input.preferredId)
      // The Phase 7 subtitle placeholder may seed the first 16:9 declination,
      // but an obsolete historical row must never be overwritten/revived.
      preferredId = (await this.repository.findById(candidate)) ? undefined : candidate
    }
    const declinaison = DeclinaisonAudiovisuelle.create({
      id: preferredId,
      projetId: projectId,
      format,
      resolution: ResolutionVideo.canonicalFor(format),
      langue,
      profilExport,
      versionProjetSource: currentSourceVersion
    })
    await this.repository.save(declinaison)
    return declinaison
  }
}
