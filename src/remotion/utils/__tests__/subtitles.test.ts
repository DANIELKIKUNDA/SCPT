import { describe, expect, it } from 'vitest'
import type { PreviewSubtitleSegment } from '../../types/preview-types'
import { findActiveSubtitle, shiftSubtitlesToWindow, subtitleDurationInFrames } from '../subtitles'

const cues: PreviewSubtitleSegment[] = [
  { id: 'a', debutMs: 0, finMs: 1000, texte: 'A', position: 'bas' },
  { id: 'b', debutMs: 1000, finMs: 2200, texte: 'B', position: 'haut' },
  { id: 'c', debutMs: 2500, finMs: 4000, texte: 'C', position: 'centre' }
]

describe('Remotion subtitle timing', () => {
  it('selects the active cue using half-open intervals', () => {
    expect(findActiveSubtitle(cues, 999)?.id).toBe('a')
    expect(findActiveSubtitle(cues, 1000)?.id).toBe('b')
  })

  it('returns null in a gap', () => {
    expect(findActiveSubtitle(cues, 2300)).toBeNull()
  })

  it('shifts project subtitles into a scene preview window', () => {
    const shifted = shiftSubtitlesToWindow(cues, 800, 1800)
    expect(shifted.map((cue) => cue.id)).toEqual(['a', 'b', 'c'])
    expect(shifted[0]).toMatchObject({ debutMs: 0, finMs: 200 })
    expect(shifted[1]).toMatchObject({ debutMs: 200, finMs: 1400 })
    expect(shifted[2]).toMatchObject({ debutMs: 1700, finMs: 1800 })
  })

  it('omits cues outside the scene window', () => {
    expect(shiftSubtitlesToWindow(cues, 5000, 1000)).toEqual([])
  })

  it('extends Remotion duration to the last subtitle frame without truncating the cue', () => {
    expect(subtitleDurationInFrames([
      { id: 'late', debutMs: 5000, finMs: 5630, texte: 'Fin', position: 'bas' }
    ], 30)).toBe(169)
    expect(subtitleDurationInFrames([], 30)).toBe(0)
  })
})
