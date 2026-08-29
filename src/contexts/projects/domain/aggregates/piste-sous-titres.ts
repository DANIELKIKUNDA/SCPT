import { ulid } from 'ulid'
import { DeclinaisonId } from '../value-objects/declinaison-id'
import { PisteSousTitresId } from '../value-objects/piste-sous-titres-id'
import { VersionMetier } from '../value-objects/version-metier'

export type SubtitleTrackStatus = 'brouillon' | 'a_resynchroniser' | 'validee' | 'obsolete'
export type SubtitlePosition = 'haut' | 'centre' | 'bas'

export interface SubtitleStyle {
  fontSize?: number
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold'
}

export interface SegmentSousTitre {
  id: string
  ordre: number
  debutMs: number
  finMs: number
  texte: string
  position: SubtitlePosition
  style?: SubtitleStyle
}

export interface PisteSousTitresProps {
  id: PisteSousTitresId
  declinaisonId: DeclinaisonId
  langue: string
  segments: SegmentSousTitre[]
  statut: SubtitleTrackStatus
  versionNarration: VersionMetier
}

const MAX_SUBTITLE_LINES = 2
const MAX_SUBTITLE_TEXT_LENGTH = 85

function cloneStyle(style?: SubtitleStyle): SubtitleStyle | undefined {
  return style ? { ...style } : undefined
}

function cloneSegment(segment: SegmentSousTitre): SegmentSousTitre {
  return { ...segment, style: cloneStyle(segment.style) }
}

function validateStyle(style?: SubtitleStyle): void {
  if (!style) return
  if (style.fontSize !== undefined && (!Number.isFinite(style.fontSize) || style.fontSize < 36 || style.fontSize > 44)) {
    throw new Error('Subtitle font size must be between 36 and 44 px')
  }
  for (const color of [style.color, style.backgroundColor]) {
    if (color !== undefined && (!color.trim() || color.length > 64)) {
      throw new Error('Invalid subtitle color')
    }
  }
  if (style.fontWeight !== undefined && !['normal', 'bold'].includes(style.fontWeight)) {
    throw new Error('Invalid subtitle font weight')
  }
}

function validateSegment(segment: SegmentSousTitre): SegmentSousTitre {
  const texte = segment.texte.trim()
  if (!segment.id) throw new Error('Subtitle segment id is required')
  if (!Number.isInteger(segment.ordre) || segment.ordre < 1) {
    throw new Error('Subtitle segment order must be >= 1')
  }
  if (!Number.isFinite(segment.debutMs) || !Number.isFinite(segment.finMs)) {
    throw new Error('Subtitle interval must be finite')
  }
  if (segment.debutMs < 0 || segment.finMs <= segment.debutMs) {
    throw new Error('Subtitle interval must have a positive duration')
  }
  if (!texte) throw new Error('Subtitle text is required')
  if (texte.length > MAX_SUBTITLE_TEXT_LENGTH) {
    throw new Error(`Subtitle text must be <= ${MAX_SUBTITLE_TEXT_LENGTH} characters`)
  }
  if (texte.split(/\r?\n/).length > MAX_SUBTITLE_LINES) {
    throw new Error(`Subtitle text must use at most ${MAX_SUBTITLE_LINES} lines`)
  }
  if (!['haut', 'centre', 'bas'].includes(segment.position)) {
    throw new Error('Invalid subtitle position')
  }
  validateStyle(segment.style)
  return {
    ...segment,
    debutMs: Math.round(segment.debutMs),
    finMs: Math.round(segment.finMs),
    texte,
    style: cloneStyle(segment.style)
  }
}

function validateSequence(segments: SegmentSousTitre[]): SegmentSousTitre[] {
  const ordered = [...segments]
    .sort((a, b) => a.debutMs - b.debutMs || a.finMs - b.finMs || a.ordre - b.ordre)
    .map(validateSegment)
    .map((segment, index) => ({ ...segment, ordre: index + 1 }))

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (current.debutMs < previous.finMs) {
      throw new Error(`Subtitle segments overlap: ${previous.id} / ${current.id}`)
    }
  }
  return ordered
}

export class PisteSousTitres {
  private constructor(private readonly props: PisteSousTitresProps) {}

  static create(params: {
    id?: PisteSousTitresId
    declinaisonId?: DeclinaisonId
    langue: string
    versionNarration?: VersionMetier
  }): PisteSousTitres {
    const langue = params.langue.trim()
    if (!langue) throw new Error('Subtitle language is required')
    return new PisteSousTitres({
      id: params.id ?? PisteSousTitresId.generate(),
      declinaisonId: params.declinaisonId ?? DeclinaisonId.generate(),
      langue,
      segments: [],
      statut: 'brouillon',
      versionNarration: params.versionNarration ?? VersionMetier.initial()
    })
  }

  static fromPersistence(props: PisteSousTitresProps): PisteSousTitres {
    const langue = props.langue.trim()
    if (!langue) throw new Error('Subtitle language is required')
    if (!['brouillon', 'a_resynchroniser', 'validee', 'obsolete'].includes(props.statut)) {
      throw new Error('Invalid subtitle track status')
    }
    const segments = validateSequence(props.segments)
    return new PisteSousTitres({ ...props, langue, segments })
  }

  get id(): PisteSousTitresId { return this.props.id }
  get declinaisonId(): DeclinaisonId { return this.props.declinaisonId }
  get langue(): string { return this.props.langue }
  get segments(): SegmentSousTitre[] { return this.props.segments.map(cloneSegment) }
  get statut(): SubtitleTrackStatus { return this.props.statut }
  get versionNarration(): VersionMetier { return this.props.versionNarration }

  synchronize(segments: Omit<SegmentSousTitre, 'id' | 'ordre'>[], versionNarration: VersionMetier): PisteSousTitres {
    const materialized = segments.map((segment, index) => ({
      ...segment,
      id: ulid(),
      ordre: index + 1,
      style: cloneStyle(segment.style)
    }))
    return new PisteSousTitres({
      ...this.props,
      segments: validateSequence(materialized),
      statut: 'brouillon',
      versionNarration
    })
  }

  addSegment(params: Omit<SegmentSousTitre, 'id' | 'ordre'>): PisteSousTitres {
    const next = validateSequence([
      ...this.props.segments,
      { ...params, id: ulid(), ordre: this.props.segments.length + 1 }
    ])
    return new PisteSousTitres({ ...this.props, segments: next, statut: this.editStatus() })
  }

  updateSegment(
    segmentId: string,
    patch: Partial<Pick<SegmentSousTitre, 'debutMs' | 'finMs' | 'texte' | 'position' | 'style'>>
  ): PisteSousTitres {
    if (!this.props.segments.some((segment) => segment.id === segmentId)) {
      throw new Error('Subtitle segment not found')
    }
    const next = validateSequence(this.props.segments.map((segment) => (
      segment.id === segmentId
        ? { ...segment, ...patch, style: patch.style === undefined ? segment.style : cloneStyle(patch.style) }
        : segment
    )))
    return new PisteSousTitres({ ...this.props, segments: next, statut: this.editStatus() })
  }

  deleteSegment(segmentId: string): PisteSousTitres {
    if (!this.props.segments.some((segment) => segment.id === segmentId)) {
      throw new Error('Subtitle segment not found')
    }
    const next = validateSequence(this.props.segments.filter((segment) => segment.id !== segmentId))
    return new PisteSousTitres({ ...this.props, segments: next, statut: this.editStatus() })
  }

  markResyncNeeded(): PisteSousTitres {
    if (this.props.statut === 'obsolete' || this.props.segments.length === 0) return this
    return new PisteSousTitres({ ...this.props, statut: 'a_resynchroniser' })
  }

  validateAgainst(versionNarration: VersionMetier): PisteSousTitres {
    if (this.props.segments.length === 0) throw new Error('Subtitle track is empty')
    if (this.props.statut === 'a_resynchroniser' || !this.props.versionNarration.equals(versionNarration)) {
      throw new Error('SUBTITLE_RESYNC_REQUIRED')
    }
    if (this.props.statut === 'obsolete') throw new Error('Subtitle track is obsolete')
    const segments = validateSequence(this.props.segments)
    return new PisteSousTitres({
      ...this.props,
      segments,
      statut: 'validee',
      versionNarration
    })
  }

  markObsolete(): PisteSousTitres {
    return new PisteSousTitres({ ...this.props, statut: 'obsolete' })
  }

  isSynchronizedWith(versionNarration: VersionMetier): boolean {
    return this.props.versionNarration.equals(versionNarration) && this.props.statut !== 'a_resynchroniser'
  }

  toJSON(): PisteSousTitresProps {
    return { ...this.props, segments: this.segments }
  }

  private editStatus(): SubtitleTrackStatus {
    if (this.props.statut === 'obsolete') return 'obsolete'
    if (this.props.statut === 'a_resynchroniser') return 'a_resynchroniser'
    return 'brouillon'
  }
}
