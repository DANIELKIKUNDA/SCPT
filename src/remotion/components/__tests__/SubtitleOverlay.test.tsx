import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubtitleOverlay } from '../SubtitleOverlay'
import type { PreviewSubtitleSegment } from '../../types/preview-types'

vi.mock('remotion', () => ({
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ fps: 30 })
}))

const activeCue: PreviewSubtitleSegment = {
  id: 'cue-2',
  debutMs: 1000,
  finMs: 2000,
  texte: 'Sous-titre actif',
  position: 'haut',
  style: { fontSize: 40, fontWeight: 'bold' }
}

describe('SubtitleOverlay', () => {
  it('renders only the cue active at the current Remotion frame', () => {
    render(<SubtitleOverlay segments={[
      { id: 'cue-1', debutMs: 0, finMs: 900, texte: 'Ancien', position: 'bas' },
      activeCue
    ]} />)

    expect(screen.getByText('Sous-titre actif')).toBeTruthy()
    expect(screen.queryByText('Ancien')).toBeNull()
  })

  it('respects the safe top placement and authored font size', () => {
    render(<SubtitleOverlay segments={[activeCue]} />)
    const overlay = screen.getByTestId('remotion-subtitle-overlay')
    expect(overlay.style.left).toBe('64px')
    expect(overlay.style.right).toBe('64px')
    expect(overlay.style.top).toBe('48px')
    expect(screen.getByText('Sous-titre actif').style.fontSize).toBe('40px')
  })

  it('renders nothing when no cue is active', () => {
    render(<SubtitleOverlay segments={[
      { id: 'future', debutMs: 2500, finMs: 3000, texte: 'Plus tard', position: 'bas' }
    ]} />)
    expect(screen.queryByTestId('remotion-subtitle-overlay')).toBeNull()
  })
})
