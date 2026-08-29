import { Composition } from 'remotion'
import { ProjectComposition } from './compositions/ProjectComposition'
import type { ProjectCompositionProps } from './types/preview-types'
import {
  PREVIEW_FPS,
  buildTimeline
} from './utils/timeline'
import { subtitleDurationInFrames } from './utils/subtitles'
import { DEFAULT_PREVIEW_DECLINATION } from './utils/declination-layout'

const defaultProps: ProjectCompositionProps = {
  scenes: [],
  themeId: 'dark',
  reduceMotion: false,
  subtitles: [],
  declination: DEFAULT_PREVIEW_DECLINATION,
  showSafeZone: false
}

export function RemotionRoot(): JSX.Element {
  return (
    <>
      <Composition
        id="SCPTProject"
        component={ProjectComposition}
        durationInFrames={1}
        fps={PREVIEW_FPS}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(
            1,
            buildTimeline(props.scenes).totalFrames,
            subtitleDurationInFrames(props.subtitles ?? [], PREVIEW_FPS)
          ),
          width: props.declination?.resolution.width ?? 1920,
          height: props.declination?.resolution.height ?? 1080
        })}
      />
    </>
  )
}
