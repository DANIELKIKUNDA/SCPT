import { describe, expect, it } from 'vitest'
import type { ProjectCompositionProps } from './types/preview-types'
import { calculateProjectMetadata } from './utils/project-metadata'

describe('Remotion root metadata', () => {
  it('forwards authored props so offline renders do not fall back to an empty project', () => {
    const props: ProjectCompositionProps = {
      scenes: [{
        id: 'scene-1',
        ordre: 1,
        type: 'texte',
        titre: 'Les logarithmes',
        texteAffiche: 'Introduction',
        dureeMs: 5000,
        composition: { backgroundColor: '#1e1e2e', layout: 'centered' },
        transition: { type: 'fade', durationMs: 300 },
        media: null
      }],
      themeId: 'dark',
      reduceMotion: false,
      subtitles: [],
      declination: {
        id: 'declination-1',
        format: 'HORIZONTAL_16_9',
        resolution: { width: 1920, height: 1080 },
        langue: 'fr',
        profilExport: 'MVP_PREMIUM',
        overrides: []
      },
      showSafeZone: false
    }

    const metadata = calculateProjectMetadata(props)

    expect(metadata.props).toBe(props)
    expect(metadata.props.scenes).toHaveLength(1)
    expect(metadata.durationInFrames).toBe(150)
    expect(metadata.width).toBe(1920)
    expect(metadata.height).toBe(1080)
  })
})
