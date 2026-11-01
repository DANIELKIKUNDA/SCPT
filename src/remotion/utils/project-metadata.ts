import type { ProjectCompositionProps } from '../types/preview-types'
import { PREVIEW_FPS, buildTimeline } from './timeline'
import { subtitleDurationInFrames } from './subtitles'

export function calculateProjectMetadata(props: ProjectCompositionProps): {
  props: ProjectCompositionProps
  durationInFrames: number
  width: number
  height: number
} {
  return {
    props,
    durationInFrames: Math.max(
      1,
      buildTimeline(props.scenes).totalFrames,
      subtitleDurationInFrames(props.subtitles ?? [], PREVIEW_FPS)
    ),
    width: props.declination?.resolution.width ?? 1920,
    height: props.declination?.resolution.height ?? 1080
  }
}
