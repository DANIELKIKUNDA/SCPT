import { AbsoluteFill, Sequence } from 'remotion'
import type { ProjectCompositionProps } from '../types/preview-types'
import { PREVIEW_THEMES } from '../themes/themes'
import { buildTimeline } from '../utils/timeline'
import { SceneRenderer } from '../scenes/SceneRenderer'

export function ProjectComposition({ scenes, themeId, reduceMotion }: ProjectCompositionProps): JSX.Element {
  const theme = PREVIEW_THEMES[themeId]
  const timeline = buildTimeline(scenes)

  if (timeline.scenes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          display: 'grid',
          placeItems: 'center',
          background: theme.background,
          color: theme.mutedText,
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          fontSize: 34
        }}
      >
        Ajoutez une scène pour commencer la prévisualisation.
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {timeline.scenes.map(({ scene, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} name={`Scene ${scene.ordre}`}>
          <SceneRenderer
            scene={scene}
            theme={theme}
            durationInFrames={durationInFrames}
            reduceMotion={reduceMotion}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
