import type { SegmentSousTitre } from '../../domain/aggregates/piste-sous-titres'

export type SubtitleExportFormat = 'srt' | 'vtt'

function pad(value: number, size: number): string {
  return Math.max(0, value).toString().padStart(size, '0')
}

function timestamp(ms: number, separator: ',' | '.'): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1000)
  const millis = safe % 1000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(millis, 3)}`
}

function ordered(segments: SegmentSousTitre[]): SegmentSousTitre[] {
  return [...segments].sort((a, b) => a.debutMs - b.debutMs || a.ordre - b.ordre)
}

function escapeVttText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function formatSrt(segments: SegmentSousTitre[]): string {
  return ordered(segments)
    .map((segment, index) => [
      String(index + 1),
      `${timestamp(segment.debutMs, ',')} --> ${timestamp(segment.finMs, ',')}`,
      segment.texte,
      ''
    ].join('\n'))
    .join('\n')
}

export function formatVtt(segments: SegmentSousTitre[]): string {
  const cues = ordered(segments)
    .map((segment) => [
      `${timestamp(segment.debutMs, '.')} --> ${timestamp(segment.finMs, '.')}`,
      escapeVttText(segment.texte),
      ''
    ].join('\n'))
    .join('\n')
  return `WEBVTT\n\n${cues}`
}

export function formatSubtitles(format: SubtitleExportFormat, segments: SegmentSousTitre[]): string {
  return format === 'srt' ? formatSrt(segments) : formatVtt(segments)
}
