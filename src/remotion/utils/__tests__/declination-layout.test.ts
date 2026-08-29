import { describe, expect, it } from 'vitest'
import type { PreviewDeclination, PreviewScene } from '../../types/preview-types'
import {
  automaticLayoutForFormat,
  isRealVerticalRecomposition,
  metricsForDeclination,
  recomposeSceneForDeclination,
  safeZoneForFormat
} from '../declination-layout'

const scene: PreviewScene = {
  id: 'scene-1',
  ordre: 1,
  type: 'texte',
  titre: 'Titre',
  texteAffiche: 'Texte',
  dureeMs: 2000,
  composition: { layout: 'split-left', backgroundColor: '#101828' },
  transition: { type: 'fade', durationMs: 300 },
  media: null
}

function declination(format: PreviewDeclination['format']): PreviewDeclination {
  const resolution = format === 'HORIZONTAL_16_9'
    ? { width: 1920, height: 1080 }
    : format === 'VERTICAL_9_16'
      ? { width: 1080, height: 1920 }
      : { width: 1080, height: 1080 }
  return { id: 'd1', format, resolution, langue: 'fr', profilExport: 'MVP_PREMIUM', overrides: [] }
}

describe('Phase 8 deterministic recomposition', () => {
  it('preserves horizontal split layouts', () => {
    expect(automaticLayoutForFormat('split-left', 'HORIZONTAL_16_9')).toBe('split-left')
  })

  it('recomposes a horizontal split into a full-width vertical flow', () => {
    expect(automaticLayoutForFormat('split-left', 'VERTICAL_9_16')).toBe('centered')
    const value = recomposeSceneForDeclination(scene, declination('VERTICAL_9_16'))
    expect(value.composition.layout).toBe('centered')
    expect(isRealVerticalRecomposition(scene, declination('VERTICAL_9_16'))).toBe(true)
  })

  it('recomposes split layout for square output too', () => {
    expect(automaticLayoutForFormat('split-right', 'CARRE_1_1')).toBe('centered')
  })

  it('applies a declination override after automatic recomposition', () => {
    const target = declination('VERTICAL_9_16')
    target.overrides = [{ sceneId: 'scene-1', layout: 'top', backgroundColor: '#000000' }]
    const value = recomposeSceneForDeclination(scene, target)
    expect(value.composition).toEqual({ layout: 'top', backgroundColor: '#000000' })
    expect(scene.composition.layout).toBe('split-left')
  })

  it('uses the frozen 16:9 minimum margins', () => {
    expect(safeZoneForFormat('HORIZONTAL_16_9')).toEqual({ left: 64, right: 64, top: 48, bottom: 48 })
  })

  it('uses larger vertical typography and protected mobile insets', () => {
    const vertical = metricsForDeclination(declination('VERTICAL_9_16'))
    const horizontal = metricsForDeclination(declination('HORIZONTAL_16_9'))
    expect(vertical.titleFontSize).toBeGreaterThan(horizontal.titleFontSize)
    expect(vertical.safeZone.top).toBeGreaterThan(horizontal.safeZone.top)
  })
})
