import type {
  SceneCompositionDto,
  SceneTransitionDto,
  SceneTypeDto,
  SubtitlePositionDto,
  SubtitleStyleDto
} from '../../shared/types/electron-api'

export type PreviewThemeId = 'dark' | 'light'

export type PreviewVideoFormat = 'HORIZONTAL_16_9' | 'VERTICAL_9_16' | 'CARRE_1_1'

export interface PreviewSafeZone {
  left: number
  right: number
  top: number
  bottom: number
}

export interface PreviewDeclinationOverride {
  sceneId: string
  layout?: SceneCompositionDto['layout']
  backgroundColor?: string
}

export interface PreviewDeclination {
  id: string | null
  format: PreviewVideoFormat
  resolution: { width: number; height: number }
  langue: string
  profilExport: string
  safeZone?: PreviewSafeZone
  overrides: PreviewDeclinationOverride[]
}

export interface PreviewMedia {
  id: string
  previewUrl: string | null
  statut: string
  mimeType: string
  nomOriginal: string
  largeur: number | null
  hauteur: number | null
}

export interface PreviewScene {
  id: string
  ordre: number
  type: SceneTypeDto
  titre: string | null
  texteAffiche: string | null
  dureeMs: number
  composition: SceneCompositionDto
  transition: SceneTransitionDto
  media: PreviewMedia | null
}


export interface PreviewSubtitleSegment {
  id: string
  debutMs: number
  finMs: number
  texte: string
  position: SubtitlePositionDto
  style?: SubtitleStyleDto
}

export type ProjectCompositionProps = {
  scenes: PreviewScene[]
  themeId: PreviewThemeId
  reduceMotion: boolean
  subtitles?: PreviewSubtitleSegment[]
  declination?: PreviewDeclination
  showSafeZone?: boolean
}
