import type { SceneLayoutDto } from '../../shared/types/electron-api'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'

export interface SafeZoneInsets {
  left: number
  right: number
  top: number
  bottom: number
}

export interface FormatLayoutMetrics {
  safeZone: SafeZoneInsets
  titleFontSize: number
  bodyFontSize: number
  formulaFontSize: number
  codeFontSize: number
  subtitleFontSize: number
  gap: number
  contentMaxWidth: number
  imageMaxHeightRatio: number
  diagramHeightRatio: number
}

/**
 * Numeric insets not specified by the product contract are conservative grid
 * defaults. 16:9 uses the exact minimum margins frozen by the premium standard.
 * 9:16 and 1:1 keep wider vertical protection while remaining on the 8 px grid.
 */
export function safeZoneForFormat(format: PreviewDeclination['format']): SafeZoneInsets {
  if (format === 'HORIZONTAL_16_9') return { left: 64, right: 64, top: 48, bottom: 48 }
  if (format === 'VERTICAL_9_16') return { left: 64, right: 64, top: 128, bottom: 128 }
  return { left: 64, right: 64, top: 64, bottom: 64 }
}

export function metricsForDeclination(declination: PreviewDeclination): FormatLayoutMetrics {
  const safeZone = declination.safeZone ?? safeZoneForFormat(declination.format)
  if (declination.format === 'VERTICAL_9_16') {
    return {
      safeZone,
      titleFontSize: 72,
      bodyFontSize: 40,
      formulaFontSize: 58,
      codeFontSize: 32,
      subtitleFontSize: 44,
      gap: 32,
      contentMaxWidth: declination.resolution.width - safeZone.left - safeZone.right,
      imageMaxHeightRatio: 0.64,
      diagramHeightRatio: 0.48
    }
  }
  if (declination.format === 'CARRE_1_1') {
    return {
      safeZone,
      titleFontSize: 64,
      bodyFontSize: 36,
      formulaFontSize: 52,
      codeFontSize: 29,
      subtitleFontSize: 42,
      gap: 28,
      contentMaxWidth: declination.resolution.width - safeZone.left - safeZone.right,
      imageMaxHeightRatio: 0.62,
      diagramHeightRatio: 0.58
    }
  }
  return {
    safeZone,
    titleFontSize: 68,
    bodyFontSize: 36,
    formulaFontSize: 52,
    codeFontSize: 30,
    subtitleFontSize: 42,
    gap: 28,
    contentMaxWidth: Math.min(1500, declination.resolution.width - safeZone.left - safeZone.right),
    imageMaxHeightRatio: 0.72,
    diagramHeightRatio: 0.67
  }
}

export function automaticLayoutForFormat(
  sourceLayout: SceneLayoutDto,
  format: PreviewDeclination['format']
): SceneLayoutDto {
  if (format === 'HORIZONTAL_16_9') return sourceLayout
  // A split composition authored for 16:9 is recomposed into a full-width
  // vertical/square flow. No crop-only path exists in Phase 8.
  if (sourceLayout === 'split-left' || sourceLayout === 'split-right') return 'centered'
  return sourceLayout
}

export function recomposeSceneForDeclination(
  scene: PreviewScene,
  declination: PreviewDeclination
): PreviewScene {
  const override = declination.overrides.find((candidate) => candidate.sceneId === scene.id)
  return {
    ...scene,
    composition: {
      ...scene.composition,
      layout: override?.layout ?? automaticLayoutForFormat(scene.composition.layout, declination.format),
      backgroundColor: override?.backgroundColor ?? scene.composition.backgroundColor
    }
  }
}

export function isRealVerticalRecomposition(
  scene: PreviewScene,
  declination: PreviewDeclination
): boolean {
  if (declination.format !== 'VERTICAL_9_16') return true
  const recomposed = recomposeSceneForDeclination(scene, declination)
  if (scene.composition.layout.startsWith('split-')) {
    return !recomposed.composition.layout.startsWith('split-') || Boolean(
      declination.overrides.find((candidate) => candidate.sceneId === scene.id)?.layout
    )
  }
  return declination.resolution.height > declination.resolution.width
}

export const DEFAULT_PREVIEW_DECLINATION: PreviewDeclination = {
  id: null,
  format: 'HORIZONTAL_16_9',
  resolution: { width: 1920, height: 1080 },
  langue: 'fr',
  profilExport: 'MVP_PREMIUM',
  safeZone: { left: 64, right: 64, top: 48, bottom: 48 },
  overrides: []
}
