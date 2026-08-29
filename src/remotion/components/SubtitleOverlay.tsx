import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties } from 'react'
import type { PreviewDeclination, PreviewSubtitleSegment } from '../types/preview-types'
import { findActiveSubtitle } from '../utils/subtitles'
import { DEFAULT_PREVIEW_DECLINATION, metricsForDeclination } from '../utils/declination-layout'

interface SubtitleOverlayProps {
  segments: PreviewSubtitleSegment[]
  declination?: PreviewDeclination
}

function verticalPosition(
  position: PreviewSubtitleSegment['position'],
  declination: PreviewDeclination
): CSSProperties {
  const metrics = metricsForDeclination(declination)
  if (position === 'haut') return { top: metrics.safeZone.top, bottom: 'auto' }
  if (position === 'centre') return { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }
  return { bottom: metrics.safeZone.bottom, top: 'auto' }
}

export function SubtitleOverlay({ segments, declination = DEFAULT_PREVIEW_DECLINATION }: SubtitleOverlayProps): JSX.Element | null {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const nowMs = (frame / fps) * 1000
  const active = findActiveSubtitle(segments, nowMs)
  if (!active) return null

  const style = active.style
  const metrics = metricsForDeclination(declination)
  const minFontSize = declination.format === 'VERTICAL_9_16' ? metrics.subtitleFontSize : 36
  const resolvedFontSize = Math.max(minFontSize, style?.fontSize ?? metrics.subtitleFontSize)
  return (
    <div
      data-testid="remotion-subtitle-overlay"
      style={{
        position: 'absolute',
        left: metrics.safeZone.left,
        right: metrics.safeZone.right,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        ...verticalPosition(active.position, declination)
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          padding: declination.format === 'VERTICAL_9_16' ? '14px 24px 16px' : '10px 20px 12px',
          borderRadius: 12,
          backgroundColor: style?.backgroundColor ?? 'rgba(0, 0, 0, 0.76)',
          color: style?.color ?? '#ffffff',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          fontSize: resolvedFontSize,
          fontWeight: style?.fontWeight ?? 'bold',
          lineHeight: 1.2,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          textShadow: '0 2px 4px rgba(0,0,0,0.85)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.28)'
        }}
      >
        {active.texte}
      </div>
    </div>
  )
}
