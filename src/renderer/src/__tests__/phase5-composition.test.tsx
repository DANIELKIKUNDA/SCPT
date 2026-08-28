import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormulaScene } from '../../../remotion/scenes/FormulaScene'
import { parseDiagramData } from '../../../remotion/scenes/diagram-data'
import { PREVIEW_THEMES, resolveThemeForBackground } from '../../../remotion/themes/themes'
import type { PreviewScene } from '../../../remotion/types/preview-types'
import {
  PREVIEW_FPS,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  buildTimeline,
  durationMsToFrames,
  findSceneAtFrame
} from '../../../remotion/utils/timeline'

function scene(overrides: Partial<PreviewScene> = {}): PreviewScene {
  return {
    id: 'scene-1',
    ordre: 1,
    type: 'texte',
    titre: 'Titre',
    texteAffiche: 'Contenu',
    dureeMs: 1000,
    composition: { backgroundColor: '#101828', layout: 'centered' },
    transition: { type: 'fade', durationMs: 300 },
    media: null,
    ...overrides
  }
}

describe('Phase 5 composition contract', () => {
  it('converts 3 seconds to exactly 90 frames at 30 fps', () => {
    expect(PREVIEW_FPS).toBe(30)
    expect(durationMsToFrames(3000)).toBe(90)
  })

  it('builds a deterministic ordered timeline', () => {
    const input = [
      scene({ id: 'b', ordre: 2, dureeMs: 2000 }),
      scene({ id: 'a', ordre: 1, dureeMs: 1000 })
    ]
    const first = buildTimeline(input)
    const second = buildTimeline(input)
    expect(first).toEqual(second)
    expect(first.scenes.map((item) => item.scene.id)).toEqual(['a', 'b'])
    expect(first.scenes.map((item) => item.from)).toEqual([0, 30])
    expect(first.totalFrames).toBe(90)
  })

  it('fails explicitly when no scene owns a requested frame', () => {
    const timeline = buildTimeline([scene({ dureeMs: 1000 })])
    expect(() => findSceneAtFrame(timeline, 30)).toThrow('Scene not found for frame 30')
  })

  it('locks Phase 5 preview to 16:9 Full HD', () => {
    expect(PREVIEW_WIDTH).toBe(1920)
    expect(PREVIEW_HEIGHT).toBe(1080)
    expect(PREVIEW_WIDTH / PREVIEW_HEIGHT).toBeCloseTo(16 / 9)
  })

  it('shows a controlled fallback for an invalid KaTeX formula', () => {
    render(
      <FormulaScene
        scene={scene({ type: 'formule', texteAffiche: '\\badcmd{' })}
        theme={PREVIEW_THEMES.dark}
      />
    )
    expect(screen.getByRole('alert').textContent).toContain('Formule invalide')
  })



  it('keeps text readable when a theme meets an explicit scene background', () => {
    const onDark = resolveThemeForBackground(PREVIEW_THEMES.light, '#111827')
    const onLight = resolveThemeForBackground(PREVIEW_THEMES.dark, '#f8fafc')
    expect(onDark.text).toBe('#f5f7fb')
    expect(onLight.text).toBe('#172033')
  })

  it('parses deterministic simple diagram data', () => {
    expect(parseDiagramData('Janvier: 12\nFévrier: 18\nMars: 25')).toEqual([
      { label: 'Janvier', value: 12 },
      { label: 'Février', value: 18 },
      { label: 'Mars', value: 25 }
    ])
  })
})
