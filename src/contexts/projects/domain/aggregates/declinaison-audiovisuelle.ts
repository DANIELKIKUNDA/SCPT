import { DeclinaisonId } from '../value-objects/declinaison-id'
import { FormatVideo, type FormatVideoValue } from '../value-objects/format-video'
import { ProfilExport } from '../value-objects/profil-export'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import { ResolutionVideo } from '../value-objects/resolution-video'
import { VersionMetier } from '../value-objects/version-metier'

export type DeclinaisonStatus =
  | 'brouillon'
  | 'adaptation_en_cours'
  | 'en_revision'
  | 'valide'
  | 'obsolete'
  | 'pret_pour_rendu'

export type DeclinaisonSceneLayout = 'centered' | 'top' | 'split-left' | 'split-right'

export interface DeclinaisonSceneOverride {
  sceneId: string
  layout?: DeclinaisonSceneLayout
  backgroundColor?: string
}

export interface DeclinaisonAudiovisuelleProps {
  id: DeclinaisonId
  projetId: ProjetAudiovisuelId
  format: FormatVideo
  resolution: ResolutionVideo
  langue: string
  profilExport: ProfilExport
  statut: DeclinaisonStatus
  versionProjetSource: VersionMetier
  version: VersionMetier
  overrides: DeclinaisonSceneOverride[]
}

const STATUSES: DeclinaisonStatus[] = [
  'brouillon',
  'adaptation_en_cours',
  'en_revision',
  'valide',
  'obsolete',
  'pret_pour_rendu'
]

function cloneOverride(value: DeclinaisonSceneOverride): DeclinaisonSceneOverride {
  return { ...value }
}

function normalizeOverride(value: DeclinaisonSceneOverride): DeclinaisonSceneOverride {
  if (!value.sceneId?.trim()) throw new Error('Declination scene override requires a scene id')
  if (value.layout !== undefined && !['centered', 'top', 'split-left', 'split-right'].includes(value.layout)) {
    throw new Error('Invalid declination scene layout override')
  }
  const backgroundColor = value.backgroundColor?.trim()
  if (backgroundColor !== undefined && (backgroundColor.length === 0 || backgroundColor.length > 64)) {
    throw new Error('Invalid declination background override')
  }
  if (value.layout === undefined && backgroundColor === undefined) {
    throw new Error('Empty declination scene override')
  }
  return {
    sceneId: value.sceneId.trim(),
    layout: value.layout,
    backgroundColor
  }
}

export class DeclinaisonAudiovisuelle {
  private constructor(private readonly props: DeclinaisonAudiovisuelleProps) {
    this.validateInvariants()
  }

  static create(params: {
    id?: DeclinaisonId
    projetId: ProjetAudiovisuelId
    format: FormatVideo
    resolution?: ResolutionVideo
    langue: string
    profilExport?: ProfilExport
    versionProjetSource: VersionMetier
  }): DeclinaisonAudiovisuelle {
    return new DeclinaisonAudiovisuelle({
      id: params.id ?? DeclinaisonId.generate(),
      projetId: params.projetId,
      format: params.format,
      resolution: params.resolution ?? ResolutionVideo.canonicalFor(params.format),
      langue: params.langue.trim(),
      profilExport: params.profilExport ?? ProfilExport.mvpPremium(),
      statut: 'brouillon',
      versionProjetSource: params.versionProjetSource,
      version: VersionMetier.initial(),
      overrides: []
    })
  }

  static fromPersistence(props: DeclinaisonAudiovisuelleProps): DeclinaisonAudiovisuelle {
    return new DeclinaisonAudiovisuelle({
      ...props,
      overrides: props.overrides.map(normalizeOverride)
    })
  }

  get id(): DeclinaisonId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get format(): FormatVideo { return this.props.format }
  get resolution(): ResolutionVideo { return this.props.resolution }
  get langue(): string { return this.props.langue }
  get profilExport(): ProfilExport { return this.props.profilExport }
  get statut(): DeclinaisonStatus { return this.props.statut }
  get versionProjetSource(): VersionMetier { return this.props.versionProjetSource }
  get version(): VersionMetier { return this.props.version }
  get overrides(): DeclinaisonSceneOverride[] { return this.props.overrides.map(cloneOverride) }

  get isObsolete(): boolean { return this.props.statut === 'obsolete' }
  get isReadyForRender(): boolean { return this.props.statut === 'pret_pour_rendu' }

  beginAdaptation(): DeclinaisonAudiovisuelle {
    this.assertEditable()
    if (this.props.statut === 'adaptation_en_cours') return this
    return this.copy({ statut: 'adaptation_en_cours', version: this.props.version.next() })
  }

  setSceneOverride(override: DeclinaisonSceneOverride): DeclinaisonAudiovisuelle {
    this.assertEditable()
    const normalized = normalizeOverride(override)
    const others = this.props.overrides.filter((candidate) => candidate.sceneId !== normalized.sceneId)
    return this.copy({
      overrides: [...others, normalized],
      statut: 'adaptation_en_cours',
      version: this.props.version.next()
    })
  }

  removeSceneOverride(sceneId: string): DeclinaisonAudiovisuelle {
    this.assertEditable()
    const next = this.props.overrides.filter((candidate) => candidate.sceneId !== sceneId)
    if (next.length === this.props.overrides.length) return this
    return this.copy({
      overrides: next,
      statut: 'adaptation_en_cours',
      version: this.props.version.next()
    })
  }

  sendToReview(currentSourceVersion: VersionMetier, sourceSceneIds: string[]): DeclinaisonAudiovisuelle {
    this.assertSourceCurrent(currentSourceVersion)
    this.assertOverridesReferenceExistingScenes(sourceSceneIds)
    this.assertRealRecomposition()
    return this.copy({ statut: 'en_revision', version: this.props.version.next() })
  }

  validate(currentSourceVersion: VersionMetier, sourceSceneIds: string[]): DeclinaisonAudiovisuelle {
    this.assertSourceCurrent(currentSourceVersion)
    this.assertOverridesReferenceExistingScenes(sourceSceneIds)
    this.assertRealRecomposition()
    if (this.props.statut === 'obsolete') throw new Error('Obsolete declination cannot be validated')
    return this.copy({ statut: 'valide', version: this.props.version.next() })
  }

  markReadyForRender(currentSourceVersion: VersionMetier): DeclinaisonAudiovisuelle {
    this.assertSourceCurrent(currentSourceVersion)
    if (this.props.statut !== 'valide') throw new Error('Declination must be validated before render readiness')
    return this.copy({ statut: 'pret_pour_rendu', version: this.props.version.next() })
  }

  markObsolete(): DeclinaisonAudiovisuelle {
    if (this.props.statut === 'obsolete') return this
    return this.copy({ statut: 'obsolete', version: this.props.version.next() })
  }

  markObsoleteIfSourceChanged(currentSourceVersion: VersionMetier): DeclinaisonAudiovisuelle {
    return this.props.versionProjetSource.equals(currentSourceVersion) ? this : this.markObsolete()
  }

  getOverride(sceneId: string): DeclinaisonSceneOverride | null {
    const found = this.props.overrides.find((candidate) => candidate.sceneId === sceneId)
    return found ? cloneOverride(found) : null
  }

  toJSON(): DeclinaisonAudiovisuelleProps {
    return { ...this.props, overrides: this.overrides }
  }

  private copy(patch: Partial<DeclinaisonAudiovisuelleProps>): DeclinaisonAudiovisuelle {
    return new DeclinaisonAudiovisuelle({ ...this.props, ...patch })
  }

  private assertEditable(): void {
    if (this.props.statut === 'obsolete') throw new Error('Obsolete declination is immutable')
    if (this.props.statut === 'pret_pour_rendu') throw new Error('Render-ready declination is frozen')
  }

  private assertSourceCurrent(currentSourceVersion: VersionMetier): void {
    if (!this.props.versionProjetSource.equals(currentSourceVersion)) {
      throw new Error('DECLINATION_SOURCE_OBSOLETE')
    }
  }

  private assertOverridesReferenceExistingScenes(sceneIds: string[]): void {
    const known = new Set(sceneIds)
    for (const override of this.props.overrides) {
      if (!known.has(override.sceneId)) {
        throw new Error(`DECLINATION_UNKNOWN_SCENE:${override.sceneId}`)
      }
    }
  }

  /**
   * Phase 8 deliberately exposes no crop-only mode. Vertical and square output
   * always flow through the deterministic recomposition engine. This invariant
   * makes it impossible to validate 9:16 as a mere 16:9 crop.
   */
  private assertRealRecomposition(): void {
    if (this.props.format.value === 'VERTICAL_9_16' && this.props.resolution.width >= this.props.resolution.height) {
      throw new Error('VERTICAL_RECOMPOSITION_REQUIRED')
    }
  }

  private validateInvariants(): void {
    if (!this.props.langue) throw new Error('Declination language is required')
    this.props.resolution.assertCompatibleWith(this.props.format)
    if (!STATUSES.includes(this.props.statut)) throw new Error('Invalid declination status')
    const seen = new Set<string>()
    for (const override of this.props.overrides.map(normalizeOverride)) {
      if (seen.has(override.sceneId)) throw new Error('Duplicate declination scene override')
      seen.add(override.sceneId)
    }
  }
}

export function formatVideoFromValue(value: FormatVideoValue): FormatVideo {
  return FormatVideo.from(value)
}
