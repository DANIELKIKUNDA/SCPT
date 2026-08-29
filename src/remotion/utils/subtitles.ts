import type { PreviewSubtitleSegment } from '../types/preview-types'

export function findActiveSubtitle(
  segments: PreviewSubtitleSegment[],
  timeMs: number
): PreviewSubtitleSegment | null {
  return segments.find((segment) => timeMs >= segment.debutMs && timeMs < segment.finMs) ?? null
}

export function shiftSubtitlesToWindow(
  segments: PreviewSubtitleSegment[],
  windowStartMs: number,
  windowDurationMs: number
): PreviewSubtitleSegment[] {
  const windowEndMs = windowStartMs + windowDurationMs
  return segments
    .filter((segment) => segment.finMs > windowStartMs && segment.debutMs < windowEndMs)
    .map((segment) => ({
      ...segment,
      debutMs: Math.max(0, segment.debutMs - windowStartMs),
      finMs: Math.min(windowDurationMs, segment.finMs - windowStartMs),
      style: segment.style ? { ...segment.style } : undefined
    }))
    .filter((segment) => segment.finMs > segment.debutMs)
}

export function subtitleDurationInFrames(
  segments: PreviewSubtitleSegment[],
  fps: number
): number {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('FPS must be positive')
  const lastEndMs = segments.reduce((max, segment) => Math.max(max, segment.finMs), 0)
  if (lastEndMs <= 0) return 0
  return Math.max(1, Math.ceil((lastEndMs / 1000) * fps))
}
