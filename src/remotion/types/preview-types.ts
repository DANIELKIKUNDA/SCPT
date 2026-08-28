import type {
  SceneCompositionDto,
  SceneTransitionDto,
  SceneTypeDto
} from '../../shared/types/electron-api'

export type PreviewThemeId = 'dark' | 'light'

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

export type ProjectCompositionProps = {
  scenes: PreviewScene[]
  themeId: PreviewThemeId
  reduceMotion: boolean
}
