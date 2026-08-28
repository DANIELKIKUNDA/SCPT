import { ulid } from 'ulid'
import { PisteNarrationId } from '../value-objects/piste-narration-id'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../value-objects/version-metier'

export type NarrationTrackStatus = 'brouillon' | 'generee' | 'validee' | 'obsolete'
export type NarrationSegmentStatus = 'generee' | 'importee' | 'erreur' | 'annulee'
export type NarrationSource = 'piper' | 'import'

export interface SegmentNarration {
  id: string
  texte: string
  sceneId: string | null
  fichierAudio: string
  dureeMs: number
  ordre: number
  statut: NarrationSegmentStatus
  source: NarrationSource
  voixId: string | null
  checksum: string
  createdAt: string
}

export interface PisteNarrationProps {
  id: PisteNarrationId
  projetId: ProjetAudiovisuelId
  langue: string
  segments: SegmentNarration[]
  priseFinaleId: string | null
  statut: NarrationTrackStatus
  versionTexte: VersionMetier
}

function validateSegment(segment: SegmentNarration): SegmentNarration {
  if (!segment.id) throw new Error('Narration segment id is required')
  if (!segment.fichierAudio || segment.fichierAudio.includes('\\')) {
    throw new Error('Narration audio path must be a relative POSIX path')
  }
  if (!Number.isFinite(segment.dureeMs) || segment.dureeMs <= 0) {
    throw new Error('Narration duration must be positive')
  }
  if (!Number.isInteger(segment.ordre) || segment.ordre < 1) {
    throw new Error('Narration segment order must be >= 1')
  }
  if (!segment.checksum) throw new Error('Narration checksum is required')
  return { ...segment }
}

export class PisteNarration {
  private constructor(private readonly props: PisteNarrationProps) {}

  static create(params: {
    id?: PisteNarrationId
    projetId: ProjetAudiovisuelId
    langue: string
    versionTexte?: VersionMetier
  }): PisteNarration {
    const langue = params.langue.trim()
    if (!langue) throw new Error('Narration language is required')
    return new PisteNarration({
      id: params.id ?? PisteNarrationId.generate(),
      projetId: params.projetId,
      langue,
      segments: [],
      priseFinaleId: null,
      statut: 'brouillon',
      versionTexte: params.versionTexte ?? VersionMetier.initial()
    })
  }

  static fromPersistence(props: PisteNarrationProps): PisteNarration {
    const segments = [...props.segments].sort((a, b) => a.ordre - b.ordre).map(validateSegment)
    if (props.priseFinaleId && !segments.some((segment) => segment.id === props.priseFinaleId)) {
      throw new Error('Narration final take does not exist')
    }
    return new PisteNarration({ ...props, segments })
  }

  get id(): PisteNarrationId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get langue(): string { return this.props.langue }
  get segments(): SegmentNarration[] { return this.props.segments.map((segment) => ({ ...segment })) }
  get priseFinaleId(): string | null { return this.props.priseFinaleId }
  get statut(): NarrationTrackStatus { return this.props.statut }
  get versionTexte(): VersionMetier { return this.props.versionTexte }

  get priseFinale(): SegmentNarration | null {
    if (!this.props.priseFinaleId) return null
    return this.props.segments.find((segment) => segment.id === this.props.priseFinaleId) ?? null
  }

  addTake(params: {
    texte: string
    sceneId?: string | null
    fichierAudio: string
    dureeMs: number
    statut: Extract<NarrationSegmentStatus, 'generee' | 'importee'>
    source: NarrationSource
    voixId?: string | null
    checksum: string
    createdAt?: string
  }): PisteNarration {
    const segment = validateSegment({
      id: ulid(),
      texte: params.texte.trim(),
      sceneId: params.sceneId ?? null,
      fichierAudio: params.fichierAudio,
      dureeMs: Math.round(params.dureeMs),
      ordre: this.props.segments.length + 1,
      statut: params.statut,
      source: params.source,
      voixId: params.voixId ?? null,
      checksum: params.checksum,
      createdAt: params.createdAt ?? new Date().toISOString()
    })
    const previousText = this.props.segments.at(-1)?.texte.trim() ?? ''
    const textChanged = this.props.segments.length > 0 && previousText !== segment.texte.trim()
    const nextTextVersion = textChanged ? this.props.versionTexte.next() : this.props.versionTexte
    return new PisteNarration({
      ...this.props,
      segments: [...this.props.segments, segment],
      priseFinaleId: textChanged ? null : this.props.priseFinaleId,
      statut: !textChanged && this.props.priseFinaleId ? 'validee' : 'generee',
      versionTexte: nextTextVersion
    })
  }

  selectFinalTake(takeId: string): PisteNarration {
    const take = this.props.segments.find((segment) => segment.id === takeId)
    if (!take) throw new Error('Narration take not found')
    if (!['generee', 'importee'].includes(take.statut)) {
      throw new Error('Narration take cannot be selected as final')
    }
    return new PisteNarration({ ...this.props, priseFinaleId: takeId, statut: 'validee' })
  }

  markObsolete(): PisteNarration {
    if (this.props.statut === 'brouillon') return this
    return new PisteNarration({ ...this.props, statut: 'obsolete' })
  }

  withTextVersion(versionTexte: VersionMetier): PisteNarration {
    const statut = this.props.versionTexte.equals(versionTexte) ? this.props.statut : 'obsolete'
    return new PisteNarration({ ...this.props, versionTexte, statut })
  }

  toJSON(): PisteNarrationProps {
    return { ...this.props, segments: this.segments }
  }
}
