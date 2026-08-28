import { Composition } from 'remotion'
import { ProjectComposition } from './compositions/ProjectComposition'
import type { ProjectCompositionProps } from './types/preview-types'
import {
  PREVIEW_FPS,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  buildTimeline
} from './utils/timeline'

const defaultProps: ProjectCompositionProps = {
  scenes: [],
  themeId: 'dark',
  reduceMotion: false
}

export function RemotionRoot(): JSX.Element {
  return (
    <>
      <Composition
        id="SCPTProject"
        component={ProjectComposition}
        durationInFrames={1}
        fps={PREVIEW_FPS}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, buildTimeline(props.scenes).totalFrames)
        })}
      />
    </>
  )
}
