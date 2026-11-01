import { Composition } from 'remotion'
import { ProjectComposition } from './compositions/ProjectComposition'
import type { ProjectCompositionProps } from './types/preview-types'
import {
  PREVIEW_FPS
} from './utils/timeline'
import { DEFAULT_PREVIEW_DECLINATION } from './utils/declination-layout'
import { calculateProjectMetadata } from './utils/project-metadata'

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
        calculateMetadata={({ props }) => calculateProjectMetadata(props)}
      />
    </>
  )
}
