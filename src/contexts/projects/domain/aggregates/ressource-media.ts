import { RessourceMediaId } from '../value-objects/ressource-media-id'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../value-objects/version-metier'
import { type MediaType, validateMediaType } from '../value-objects/ressource-media-type'

export type MediaStatut = 'disponible' | 'manquante' | 'corrompue'
export type MediaDroits = 'originale' | 'autorisee' | 'libre' | 'inconnue' | 'interdite'


export interface RessourceMediaProps {
  id: RessourceMediaId
  projetId: ProjetAudiovisuelId
  type: MediaType
  cheminRelatif: string
  nomOriginal: string
  checksum: string
  tailleOctets: number
  mimeType: string
  dureeMs: number | null
  largeur: number | null
  hauteur: number | null
  statut: MediaStatut
  droits: MediaDroits
  version: VersionMetier
  /** ID of the original resource if this is a derivation */
  sourceMediaId: RessourceMediaId | null
}

export class RessourceMedia {
  private constructor(private readonly props: RessourceMediaProps) {}

  static create(params: {
    id?: RessourceMediaId
    projetId: ProjetAudiovisuelId
    type: string
    cheminRelatif: string
    nomOriginal: string
    checksum: string
    tailleOctets: number
    mimeType: string
    dureeMs?: number | null
    largeur?: number | null
    hauteur?: number | null
    statut?: MediaStatut
    droits?: MediaDroits
    sourceMediaId?: RessourceMediaId | null
  }): RessourceMedia {
    if (!params.cheminRelatif || params.cheminRelatif.includes('\\')) {
      throw new Error('cheminRelatif must be a non-empty POSIX path')
    }
    if (!params.nomOriginal) throw new Error('nomOriginal is required')
    if (!params.checksum) throw new Error('checksum is required')
    if (params.tailleOctets < 0) throw new Error('tailleOctets must be >= 0')

    return new RessourceMedia({
      id: params.id ?? RessourceMediaId.generate(),
      projetId: params.projetId,
      type: validateMediaType(params.type),
      cheminRelatif: params.cheminRelatif,
      nomOriginal: params.nomOriginal,
      checksum: params.checksum,
      tailleOctets: params.tailleOctets,
      mimeType: params.mimeType,
      dureeMs: params.dureeMs ?? null,
      largeur: params.largeur ?? null,
      hauteur: params.hauteur ?? null,
      statut: params.statut ?? 'disponible',
      droits: params.droits ?? 'inconnue',
      version: VersionMetier.initial(),
      sourceMediaId: params.sourceMediaId ?? null
    })
  }

  static fromPersistence(props: RessourceMediaProps): RessourceMedia {
    return new RessourceMedia(props)
  }

  get id(): RessourceMediaId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get type(): MediaType { return this.props.type }
  get cheminRelatif(): string { return this.props.cheminRelatif }
  get nomOriginal(): string { return this.props.nomOriginal }
  get checksum(): string { return this.props.checksum }
  get tailleOctets(): number { return this.props.tailleOctets }
  get mimeType(): string { return this.props.mimeType }
  get dureeMs(): number | null { return this.props.dureeMs }
  get largeur(): number | null { return this.props.largeur }
  get hauteur(): number | null { return this.props.hauteur }
  get statut(): MediaStatut { return this.props.statut }
  get droits(): MediaDroits { return this.props.droits }
  get version(): VersionMetier { return this.props.version }
  get sourceMediaId(): RessourceMediaId | null { return this.props.sourceMediaId }

  get isDisponible(): boolean { return this.props.statut === 'disponible' }
  get isManquante(): boolean { return this.props.statut === 'manquante' }
  get isCorrompue(): boolean { return this.props.statut === 'corrompue' }

  /** Mark as missing (file was moved/deleted) */
  marquerManquante(): RessourceMedia {
    return new RessourceMedia({ ...this.props, statut: 'manquante', version: this.props.version.next() })
  }

  /** Restore disponibilité after replacement */
  restaurer(): RessourceMedia {
    return new RessourceMedia({ ...this.props, statut: 'disponible', version: this.props.version.next() })
  }

  toJSON(): RessourceMediaProps {
    return { ...this.props }
  }
}