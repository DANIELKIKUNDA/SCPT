import { DeclinaisonId } from '../value-objects/declinaison-id'
import { ExportId } from '../value-objects/export-id'
import { ProfilExport } from '../value-objects/profil-export'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../value-objects/version-metier'

export type ExportAudiovisuelStatus =
  | 'demande'
  | 'en_attente'
  | 'en_preparation'
  | 'en_composition'
  | 'en_encodage'
  | 'en_verification'
  | 'termine'
  | 'echoue'
  | 'annule'

export interface EmpreinteDependancesRendu {
  versionProjetSource: VersionMetier
  versionDeclinaison: VersionMetier
}

export interface ExportAudiovisuelProps {
  id: ExportId
  projetId: ProjetAudiovisuelId
  declinaisonId: DeclinaisonId
  tentative: number
  statut: ExportAudiovisuelStatus
  progression: number
  cheminFichier: string | null
  checksum: string | null
  diagnostic: string | null
  profil: ProfilExport
  versionsSources: EmpreinteDependancesRendu
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

const ALL_STATUSES: ExportAudiovisuelStatus[] = [
  'demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification',
  'termine', 'echoue', 'annule'
]

const ACTIVE_STATUSES: ExportAudiovisuelStatus[] = [
  'demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification'
]

const PROCESSING_STATUSES: ExportAudiovisuelStatus[] = [
  'en_preparation', 'en_composition', 'en_encodage', 'en_verification'
]

function assertRelativeProjectPath(value: string): void {
  const normalized = value.replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('Render output path must be relative to the project')
  }
}

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value.getTime()) : null
}

export class ExportAudiovisuel {
  private constructor(private readonly props: ExportAudiovisuelProps) {
    this.validateInvariants()
  }

  static request(params: {
    id?: ExportId
    projetId: ProjetAudiovisuelId
    declinaisonId: DeclinaisonId
    tentative: number
    profil: ProfilExport
    versionsSources: EmpreinteDependancesRendu
    now?: Date
  }): ExportAudiovisuel {
    const now = params.now ?? new Date()
    return new ExportAudiovisuel({
      id: params.id ?? ExportId.generate(),
      projetId: params.projetId,
      declinaisonId: params.declinaisonId,
      tentative: params.tentative,
      statut: 'demande',
      progression: 0,
      cheminFichier: null,
      checksum: null,
      diagnostic: null,
      profil: params.profil,
      versionsSources: params.versionsSources,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null
    })
  }

  static fromPersistence(props: ExportAudiovisuelProps): ExportAudiovisuel {
    return new ExportAudiovisuel({
      ...props,
      createdAt: new Date(props.createdAt.getTime()),
      updatedAt: new Date(props.updatedAt.getTime()),
      startedAt: cloneDate(props.startedAt),
      finishedAt: cloneDate(props.finishedAt)
    })
  }

  get id(): ExportId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get declinaisonId(): DeclinaisonId { return this.props.declinaisonId }
  get tentative(): number { return this.props.tentative }
  get statut(): ExportAudiovisuelStatus { return this.props.statut }
  get progression(): number { return this.props.progression }
  get cheminFichier(): string | null { return this.props.cheminFichier }
  get checksum(): string | null { return this.props.checksum }
  get diagnostic(): string | null { return this.props.diagnostic }
  get profil(): ProfilExport { return this.props.profil }
  get versionsSources(): EmpreinteDependancesRendu { return { ...this.props.versionsSources } }
  get createdAt(): Date { return new Date(this.props.createdAt.getTime()) }
  get updatedAt(): Date { return new Date(this.props.updatedAt.getTime()) }
  get startedAt(): Date | null { return cloneDate(this.props.startedAt) }
  get finishedAt(): Date | null { return cloneDate(this.props.finishedAt) }

  get isActive(): boolean { return ACTIVE_STATUSES.includes(this.props.statut) }
  get isProcessing(): boolean { return PROCESSING_STATUSES.includes(this.props.statut) }
  get isTerminal(): boolean { return ['termine', 'echoue', 'annule'].includes(this.props.statut) }
  get canRetry(): boolean { return this.props.statut === 'echoue' || this.props.statut === 'annule' }

  enqueue(now = new Date()): ExportAudiovisuel {
    if (this.props.statut !== 'demande') throw new Error('RENDER_INVALID_TRANSITION')
    return this.copy({ statut: 'en_attente', progression: 0, updatedAt: now })
  }

  beginPreparation(now = new Date()): ExportAudiovisuel {
    if (!['demande', 'en_attente'].includes(this.props.statut)) throw new Error('RENDER_INVALID_TRANSITION')
    return this.copy({
      statut: 'en_preparation',
      progression: Math.max(this.props.progression, 1),
      diagnostic: null,
      startedAt: this.props.startedAt ?? now,
      updatedAt: now,
      finishedAt: null
    })
  }

  beginComposition(now = new Date()): ExportAudiovisuel {
    if (this.props.statut !== 'en_preparation') throw new Error('RENDER_INVALID_TRANSITION')
    return this.copy({ statut: 'en_composition', progression: Math.max(this.props.progression, 8), updatedAt: now })
  }

  updateCompositionProgress(value: number, now = new Date()): ExportAudiovisuel {
    if (this.props.statut !== 'en_composition') throw new Error('RENDER_INVALID_TRANSITION')
    if (!Number.isFinite(value)) throw new Error('Invalid render progress')
    const normalized = Math.max(this.props.progression, Math.min(90, Math.max(8, Math.round(value))))
    return normalized === this.props.progression ? this : this.copy({ progression: normalized, updatedAt: now })
  }

  beginEncoding(now = new Date()): ExportAudiovisuel {
    if (this.props.statut !== 'en_composition') throw new Error('RENDER_INVALID_TRANSITION')
    return this.copy({ statut: 'en_encodage', progression: Math.max(this.props.progression, 91), updatedAt: now })
  }

  beginVerification(now = new Date()): ExportAudiovisuel {
    if (!['en_composition', 'en_encodage'].includes(this.props.statut)) throw new Error('RENDER_INVALID_TRANSITION')
    return this.copy({ statut: 'en_verification', progression: Math.max(this.props.progression, 96), updatedAt: now })
  }

  complete(params: { cheminFichier: string; checksum: string; now?: Date }): ExportAudiovisuel {
    if (this.props.statut !== 'en_verification') throw new Error('RENDER_INVALID_TRANSITION')
    assertRelativeProjectPath(params.cheminFichier)
    if (!/^[a-f0-9]{64}$/i.test(params.checksum)) throw new Error('Invalid render checksum')
    const now = params.now ?? new Date()
    return this.copy({
      statut: 'termine',
      progression: 100,
      cheminFichier: params.cheminFichier.replace(/\\/g, '/'),
      checksum: params.checksum.toLowerCase(),
      diagnostic: null,
      updatedAt: now,
      finishedAt: now
    })
  }

  fail(diagnostic: string, now = new Date()): ExportAudiovisuel {
    if (this.isTerminal) throw new Error('RENDER_INVALID_TRANSITION')
    const message = diagnostic.trim().slice(0, 4000)
    return this.copy({
      statut: 'echoue',
      diagnostic: message || 'Rendu échoué',
      cheminFichier: null,
      checksum: null,
      updatedAt: now,
      finishedAt: now
    })
  }

  cancel(diagnostic = 'Rendu annulé par l’utilisateur.', now = new Date()): ExportAudiovisuel {
    if (this.isTerminal) return this
    return this.copy({
      statut: 'annule',
      diagnostic: diagnostic.trim().slice(0, 4000) || 'Rendu annulé',
      cheminFichier: null,
      checksum: null,
      updatedAt: now,
      finishedAt: now
    })
  }

  retry(versionsSources: EmpreinteDependancesRendu, now = new Date()): ExportAudiovisuel {
    if (!this.canRetry) throw new Error('RENDER_NOT_RETRYABLE')
    return this.copy({
      tentative: this.props.tentative + 1,
      statut: 'demande',
      progression: 0,
      cheminFichier: null,
      checksum: null,
      diagnostic: null,
      versionsSources,
      updatedAt: now,
      startedAt: null,
      finishedAt: null
    })
  }

  prepareForResume(now = new Date()): ExportAudiovisuel {
    if (this.props.statut === 'demande') return this.enqueue(now)
    if (this.props.statut === 'en_attente') return this
    if (!this.isProcessing) return this
    return this.copy({
      tentative: this.props.tentative + 1,
      statut: 'en_attente',
      progression: 0,
      cheminFichier: null,
      checksum: null,
      diagnostic: 'Tentative précédente interrompue. Reprise automatique planifiée.',
      updatedAt: now,
      startedAt: null,
      finishedAt: null
    })
  }

  toJSON(): ExportAudiovisuelProps {
    return {
      ...this.props,
      versionsSources: { ...this.props.versionsSources },
      createdAt: new Date(this.props.createdAt.getTime()),
      updatedAt: new Date(this.props.updatedAt.getTime()),
      startedAt: cloneDate(this.props.startedAt),
      finishedAt: cloneDate(this.props.finishedAt)
    }
  }

  private copy(patch: Partial<ExportAudiovisuelProps>): ExportAudiovisuel {
    return new ExportAudiovisuel({ ...this.props, ...patch })
  }

  private validateInvariants(): void {
    if (!ALL_STATUSES.includes(this.props.statut)) throw new Error('Invalid render status')
    if (!Number.isInteger(this.props.tentative) || this.props.tentative < 1) throw new Error('Invalid render attempt')
    if (!Number.isInteger(this.props.progression) || this.props.progression < 0 || this.props.progression > 100) {
      throw new Error('Invalid render progress')
    }
    if (this.props.cheminFichier) assertRelativeProjectPath(this.props.cheminFichier)
    if (this.props.checksum && !/^[a-f0-9]{64}$/i.test(this.props.checksum)) throw new Error('Invalid render checksum')
    if (this.props.statut === 'termine' && (!this.props.cheminFichier || !this.props.checksum || this.props.progression !== 100)) {
      throw new Error('Completed render requires immutable output metadata')
    }
    if (!Number.isFinite(this.props.createdAt.getTime()) || !Number.isFinite(this.props.updatedAt.getTime())) {
      throw new Error('Invalid render timestamps')
    }
  }
}
