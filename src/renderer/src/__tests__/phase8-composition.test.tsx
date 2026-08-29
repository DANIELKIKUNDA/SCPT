import { render, screen } from '@testing-library/react'
import type { CSSProperties, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectComposition } from '../../../remotion/compositions/ProjectComposition'
import { TextScene } from '../../../remotion/scenes/TextScene'
import { PREVIEW_THEMES } from '../../../remotion/themes/themes'
import type { PreviewDeclination, PreviewScene } from '../../../remotion/types/preview-types'

vi.mock('remotion', () => ({
  AbsoluteFill: ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div style={style}>{children}</div>,
  Sequence: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920 })
}))

const vertical: PreviewDeclination = {
  id: 'vertical',
  format: 'VERTICAL_9_16',
  resolution: { width: 1080, height: 1920 },
  langue: 'fr',
  profilExport: 'MVP_PREMIUM',
  safeZone: { left: 64, right: 64, top: 128, bottom: 128 },
  overrides: []
}

const scene: PreviewScene = {
  id: 'scene-1',
  ordre: 1,
  type: 'texte',
  titre: 'Logarithmes',
  texteAffiche: 'Une composition verticale réelle.',
  dureeMs: 2000,
  composition: { layout: 'split-left', backgroundColor: '#0b1020' },
  transition: { type: 'none', durationMs: 0 },
  media: null
}

describe('Phase 8 Remotion multi-format composition', () => {
  it('renders a visible safe-zone overlay only when requested', () => {
    const { rerender } = render(
      <ProjectComposition scenes={[scene]} themeId="dark" reduceMotion subtitles={[]} declination={vertical} showSafeZone />
    )
    expect(screen.getByTestId('safe-zone-overlay')).toBeTruthy()
    rerender(
      <ProjectComposition scenes={[scene]} themeId="dark" reduceMotion subtitles={[]} declination={vertical} showSafeZone={false} />
    )
    expect(screen.queryByTestId('safe-zone-overlay')).toBeNull()
  })

  it('uses larger title typography in vertical format', () => {
    render(<TextScene scene={scene} theme={PREVIEW_THEMES.dark} declination={vertical} />)
    expect(screen.getByText('Logarithmes').style.fontSize).toBe('72px')
  })

  it('keeps the source scene object immutable while ProjectComposition recomposes it', () => {
    render(<ProjectComposition scenes={[scene]} themeId="dark" reduceMotion={false} subtitles={[]} declination={vertical} />)
    expect(scene.composition.layout).toBe('split-left')
    expect(screen.getByText('Une composition verticale réelle.')).toBeTruthy()
  })
})
