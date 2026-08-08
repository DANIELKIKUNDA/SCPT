import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import type { StatutProjet } from '../value-objects/statut-projet'
import { StatutProjet as S, transitionAllowed } from '../value-objects/statut-projet'

export interface ProjetAudiovisuelProps {
  id: ProjetAudiovisuelId
  titre: string
  type: string
  objectif: string
  publicCible: string
  langueSource: string
  statut: StatutProjet
  version: number
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  previousStatut: StatutProjet | null
}

export class ProjetAudiovisuel {
  private constructor(private readonly props: ProjetAudiovisuelProps) {}

  static create(params: {
    titre: string
    type: string
    objectif: string
    publicCible: string
    langueSource: string
  }): ProjetAudiovisuel {
    const now = new Date()

    const projet = new ProjetAudiovisuel({
      id: ProjetAudiovisuelId.generate(),
      titre: params.titre.trim(),
      type: params.type.trim(),
      objectif: params.objectif.trim(),
      publicCible: params.publicCible.trim(),
      langueSource: params.langueSource.trim(),
      statut: S.BROUILLON,
      version: 1,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      previousStatut: null
    })

    projet.validateInvariants()
    return projet
  }

  static fromPersistence(props: ProjetAudiovisuelProps): ProjetAudiovisuel {
    const projet = new ProjetAudiovisuel(props)
    projet.validateInvariants()
    return projet
  }

  get id(): ProjetAudiovisuelId {
    return this.props.id
  }

  get titre(): string {
    return this.props.titre
  }

  get type(): string {
    return this.props.type
  }

  get objectif(): string {
    return this.props.objectif
  }

  get publicCible(): string {
    return this.props.publicCible
  }

  get langueSource(): string {
    return this.props.langueSource
  }

  get statut(): StatutProjet {
    return this.props.statut
  }

  get version(): number {
    return this.props.version
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt
  }

  get previousStatut(): StatutProjet | null {
    return this.props.previousStatut
  }

  get isArchived(): boolean {
    return this.props.statut === S.ARCHIVE
  }

  updateTitre(titre: string): void {
    this.assertNotArchived()
    this.props.titre = titre.trim()
    this.touch()
  }

  updateMetadata(params: { objectif?: string; publicCible?: string; type?: string }): void {
    this.assertNotArchived()
    if (params.objectif !== undefined) this.props.objectif = params.objectif.trim()
    if (params.publicCible !== undefined) this.props.publicCible = params.publicCible.trim()
    if (params.type !== undefined) this.props.type = params.type.trim()
    this.touch()
  }

  changeStatut(target: StatutProjet): void {
    if (!transitionAllowed(this.props.statut, target)) {
      throw new Error(
        `Transition de statut non autorisée: ${this.props.statut} → ${target}`
      )
    }
    this.props.statut = target
    this.touch()
  }

  archiver(): void {
    const previousStatut = this.props.statut
    this.props.statut = S.ARCHIVE
    this.props.archivedAt = new Date()
    this.props.previousStatut = previousStatut
    this.touch()
  }

  restore(): void {
    if (this.props.statut !== S.ARCHIVE) {
      throw new Error('Seul un projet archivé peut être restauré')
    }
    const prev = this.props.previousStatut ?? S.BROUILLON
    this.props.statut = prev
    this.props.previousStatut = null
    this.props.archivedAt = null
    this.touch()
  }

  private touch(): void {
    this.props.updatedAt = new Date()
    this.props.version += 1
  }

  private assertNotArchived(): void {
    if (this.isArchived) {
      throw new Error('Impossible de modifier un projet archivé')
    }
  }

  private validateInvariants(): void {
    if (!this.props.titre || this.props.titre.trim().length === 0) {
      throw new Error('Le titre du projet est requis')
    }
    if (!this.props.type || this.props.type.trim().length === 0) {
      throw new Error('Le type de projet est requis')
    }
    if (!this.props.langueSource || this.props.langueSource.trim().length === 0) {
      throw new Error('La langue source est requise')
    }
  }
}