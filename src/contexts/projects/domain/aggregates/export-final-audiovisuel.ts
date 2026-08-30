import { DeclinaisonId } from '../value-objects/declinaison-id'
import { ExportId } from '../value-objects/export-id'
import { ProfilExport } from '../value-objects/profil-export'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'

export type ExportFinalStatus =
  | 'demande'
  | 'en_attente'
  | 'en_preparation'
  | 'en_encodage'
  | 'en_verification'
  | 'termine'
  | 'echoue'
  | 'annule'

export interface ExportFinalTechnique {
  nomFichier: string
  cheminFichier: string
  checksum: string
  tailleOctets: number
  dureeMs: number
  largeur: number
  hauteur: number
  fps: number
  codecVideo: 'h264'
  pixelFormat: 'yuv420p'
  codecAudio: 'aac'
  audioSampleRate: 48000
}

export interface ExportFinalAudiovisuelProps {
  id: ExportId
  projetId: ProjetAudiovisuelId
  renderJobId: ExportId
  declinaisonId: DeclinaisonId
  tentative: number
  statut: ExportFinalStatus
  progression: number
  profil: ProfilExport
  sourceRenderChecksum: string
  narrationTakeId: string
  narrationChecksum: string
  technique: ExportFinalTechnique | null
  diagnostic: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

const STATUSES: readonly ExportFinalStatus[] = [
  'demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification',
  'termine', 'echoue', 'annule'
]
const ACTIVE: readonly ExportFinalStatus[] = ['demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification']
const PROCESSING: readonly ExportFinalStatus[] = ['en_preparation', 'en_encodage', 'en_verification']

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value.getTime()) : null
}

function assertChecksum(value: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('FINAL_EXPORT_INVALID_CHECKSUM')
}

function assertRelativeProjectPath(value: string): void {
  const normalized = value.replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('FINAL_EXPORT_PATH_MUST_BE_RELATIVE')
  }
}

function validateTechnique(value: ExportFinalTechnique): void {
  if (!value.nomFichier.trim() || !value.nomFichier.toLowerCase().endsWith('.mp4')) throw new Error('FINAL_EXPORT_INVALID_FILENAME')
  assertRelativeProjectPath(value.cheminFichier)
  assertChecksum(value.checksum)
  if (!Number.isInteger(value.tailleOctets) || value.tailleOctets <= 0) throw new Error('FINAL_EXPORT_INVALID_SIZE')
  if (!Number.isInteger(value.dureeMs) || value.dureeMs <= 0) throw new Error('FINAL_EXPORT_INVALID_DURATION')
  if (!Number.isInteger(value.largeur) || value.largeur <= 0 || !Number.isInteger(value.hauteur) || value.hauteur <= 0) {
    throw new Error('FINAL_EXPORT_INVALID_RESOLUTION')
  }
  if (!Number.isFinite(value.fps) || Math.abs(value.fps - 30) > 0.1) throw new Error('FINAL_EXPORT_INVALID_FPS')
  if (value.codecVideo !== 'h264' || value.pixelFormat !== 'yuv420p') throw new Error('FINAL_EXPORT_INVALID_VIDEO_PROFILE')
  if (value.codecAudio !== 'aac' || value.audioSampleRate !== 48000) throw new Error('FINAL_EXPORT_INVALID_AUDIO_PROFILE')
}

export class ExportFinalAudiovisuel {
  private constructor(private readonly props: ExportFinalAudiovisuelProps) {
    this.validateInvariants()
  }

  static request(params: {
    id?: ExportId
    projetId: ProjetAudiovisuelId
    renderJobId: ExportId
    declinaisonId: DeclinaisonId
    tentative: number
    profil: ProfilExport
    sourceRenderChecksum: string
    narrationTakeId: string
    narrationChecksum: string
    now?: Date
  }): ExportFinalAudiovisuel {
    const now = params.now ?? new Date()
    return new ExportFinalAudiovisuel({
      id: params.id ?? ExportId.generate(),
      projetId: params.projetId,
      renderJobId: params.renderJobId,
      declinaisonId: params.declinaisonId,
      tentative: params.tentative,
      statut: 'demande',
      progression: 0,
      profil: params.profil,
      sourceRenderChecksum: params.sourceRenderChecksum.toLowerCase(),
      narrationTakeId: params.narrationTakeId,
      narrationChecksum: params.narrationChecksum.toLowerCase(),
      technique: null,
      diagnostic: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null
    })
  }

  static fromPersistence(props: ExportFinalAudiovisuelProps): ExportFinalAudiovisuel {
    return new ExportFinalAudiovisuel({
      ...props,
      technique: props.technique ? { ...props.technique } : null,
      createdAt: new Date(props.createdAt.getTime()),
      updatedAt: new Date(props.updatedAt.getTime()),
      startedAt: cloneDate(props.startedAt),
      finishedAt: cloneDate(props.finishedAt)
    })
  }

  get id(): ExportId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get renderJobId(): ExportId { return this.props.renderJobId }
  get declinaisonId(): DeclinaisonId { return this.props.declinaisonId }
  get tentative(): number { return this.props.tentative }
  get statut(): ExportFinalStatus { return this.props.statut }
  get progression(): number { return this.props.progression }
  get profil(): ProfilExport { return this.props.profil }
  get sourceRenderChecksum(): string { return this.props.sourceRenderChecksum }
  get narrationTakeId(): string { return this.props.narrationTakeId }
  get narrationChecksum(): string { return this.props.narrationChecksum }
  get technique(): ExportFinalTechnique | null { return this.props.technique ? { ...this.props.technique } : null }
  get diagnostic(): string | null { return this.props.diagnostic }
  get createdAt(): Date { return new Date(this.props.createdAt.getTime()) }
  get updatedAt(): Date { return new Date(this.props.updatedAt.getTime()) }
  get startedAt(): Date | null { return cloneDate(this.props.startedAt) }
  get finishedAt(): Date | null { return cloneDate(this.props.finishedAt) }

  get isActive(): boolean { return ACTIVE.includes(this.props.statut) }
  get isProcessing(): boolean { return PROCESSING.includes(this.props.statut) }
  get isTerminal(): boolean { return ['termine', 'echoue', 'annule'].includes(this.props.statut) }
  get canRetry(): boolean { return this.props.statut === 'echoue' || this.props.statut === 'annule' }

  enqueue(now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut !== 'demande') throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    return this.copy({ statut: 'en_attente', updatedAt: now })
  }

  beginPreparation(now = new Date()): ExportFinalAudiovisuel {
    if (!['demande', 'en_attente'].includes(this.props.statut)) throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    return this.copy({
      statut: 'en_preparation', progression: Math.max(this.props.progression, 2), diagnostic: null,
      startedAt: this.props.startedAt ?? now, finishedAt: null, updatedAt: now
    })
  }

  beginEncoding(now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut !== 'en_preparation') throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    return this.copy({ statut: 'en_encodage', progression: Math.max(this.props.progression, 10), updatedAt: now })
  }

  updateEncodingProgress(value: number, now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut !== 'en_encodage') throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    if (!Number.isFinite(value)) throw new Error('FINAL_EXPORT_INVALID_PROGRESS')
    const normalized = Math.max(this.props.progression, Math.min(92, Math.max(10, Math.round(value))))
    return normalized === this.props.progression ? this : this.copy({ progression: normalized, updatedAt: now })
  }

  beginVerification(now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut !== 'en_encodage') throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    return this.copy({ statut: 'en_verification', progression: Math.max(this.props.progression, 95), updatedAt: now })
  }

  complete(technique: ExportFinalTechnique, now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut !== 'en_verification') throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    validateTechnique(technique)
    return this.copy({
      statut: 'termine', progression: 100, technique: { ...technique }, diagnostic: null,
      updatedAt: now, finishedAt: now
    })
  }

  fail(diagnostic: string, now = new Date()): ExportFinalAudiovisuel {
    if (this.isTerminal) throw new Error('FINAL_EXPORT_INVALID_TRANSITION')
    return this.copy({
      statut: 'echoue', diagnostic: diagnostic.trim().slice(0, 4000) || 'Export final échoué', technique: null,
      updatedAt: now, finishedAt: now
    })
  }

  cancel(diagnostic = 'Export final annulé par l’utilisateur.', now = new Date()): ExportFinalAudiovisuel {
    if (this.isTerminal) return this
    return this.copy({
      statut: 'annule', diagnostic: diagnostic.trim().slice(0, 4000) || 'Export final annulé', technique: null,
      updatedAt: now, finishedAt: now
    })
  }

  retry(params: { sourceRenderChecksum: string; narrationTakeId: string; narrationChecksum: string }, now = new Date()): ExportFinalAudiovisuel {
    if (!this.canRetry) throw new Error('FINAL_EXPORT_NOT_RETRYABLE')
    return this.copy({
      tentative: this.props.tentative + 1,
      statut: 'demande', progression: 0, technique: null, diagnostic: null,
      sourceRenderChecksum: params.sourceRenderChecksum.toLowerCase(),
      narrationTakeId: params.narrationTakeId,
      narrationChecksum: params.narrationChecksum.toLowerCase(),
      updatedAt: now, startedAt: null, finishedAt: null
    })
  }

  prepareForResume(now = new Date()): ExportFinalAudiovisuel {
    if (this.props.statut === 'demande') return this.enqueue(now)
    if (this.props.statut === 'en_attente') return this
    if (!this.isProcessing) return this
    return this.copy({
      tentative: this.props.tentative + 1,
      statut: 'en_attente', progression: 0, technique: null,
      diagnostic: 'Tentative d’export final interrompue. Reprise automatique planifiée.',
      updatedAt: now, startedAt: null, finishedAt: null
    })
  }

  toJSON(): ExportFinalAudiovisuelProps {
    return {
      ...this.props,
      technique: this.props.technique ? { ...this.props.technique } : null,
      createdAt: new Date(this.props.createdAt.getTime()),
      updatedAt: new Date(this.props.updatedAt.getTime()),
      startedAt: cloneDate(this.props.startedAt),
      finishedAt: cloneDate(this.props.finishedAt)
    }
  }

  private copy(patch: Partial<ExportFinalAudiovisuelProps>): ExportFinalAudiovisuel {
    return new ExportFinalAudiovisuel({ ...this.props, ...patch })
  }

  private validateInvariants(): void {
    if (!STATUSES.includes(this.props.statut)) throw new Error('FINAL_EXPORT_INVALID_STATUS')
    if (!Number.isInteger(this.props.tentative) || this.props.tentative < 1) throw new Error('FINAL_EXPORT_INVALID_ATTEMPT')
    if (!Number.isInteger(this.props.progression) || this.props.progression < 0 || this.props.progression > 100) {
      throw new Error('FINAL_EXPORT_INVALID_PROGRESS')
    }
    assertChecksum(this.props.sourceRenderChecksum)
    assertChecksum(this.props.narrationChecksum)
    if (!this.props.narrationTakeId) throw new Error('FINAL_EXPORT_NARRATION_TAKE_REQUIRED')
    if (this.props.statut === 'termine') {
      if (!this.props.technique || this.props.progression !== 100) throw new Error('FINAL_EXPORT_COMPLETED_WITHOUT_FILE')
      validateTechnique(this.props.technique)
    } else if (this.props.technique) {
      throw new Error('FINAL_EXPORT_TECHNIQUE_ONLY_ON_COMPLETION')
    }
  }
}
