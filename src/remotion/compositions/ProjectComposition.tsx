import { AbsoluteFill, Sequence } from 'remotion'
import type { ProjectCompositionProps } from '../types/preview-types'
import { PREVIEW_THEMES } from '../themes/themes'
import { buildTimeline } from '../utils/timeline'
import { SceneRenderer } from '../scenes/SceneRenderer'
import { SubtitleOverlay } from '../components/SubtitleOverlay'
import { SafeZoneOverlay } from '../components/SafeZoneOverlay'
import {
  DEFAULT_PREVIEW_DECLINATION,
  recomposeSceneForDeclination,
  safeZoneForFormat
} from '../utils/declination-layout'

export function ProjectComposition({
  scenes,
  themeId,
  reduceMotion,
  subtitles = [],
  declination = DEFAULT_PREVIEW_DECLINATION,
  showSafeZone = false
}: ProjectCompositionProps): JSX.Element {
  const theme = PREVIEW_THEMES[themeId]
  const recomposedScenes = scenes.map((scene) => recomposeSceneForDeclination(scene, declination))
  const timeline = buildTimeline(recomposedScenes)
  const safeZone = declination.safeZone ?? safeZoneForFormat(declination.format)

  if (timeline.scenes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          display: 'grid',
          placeItems: 'center',
          background: theme.background,
          color: theme.mutedText,
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          fontSize: declination.format === 'VERTICAL_9_16' ? 40 : 34,
          padding: `${safeZone.top}px ${safeZone.right}px ${safeZone.bottom}px ${safeZone.left}px`,
          textAlign: 'center'
        }}
      >
        Ajoutez une scène pour commencer la prévisualisation.
        {showSafeZone && <SafeZoneOverlay safeZone={safeZone} />}
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
            declination={declination}
          />
        </Sequence>
      ))}
      <SubtitleOverlay segments={subtitles} declination={declination} />
      {showSafeZone && <SafeZoneOverlay safeZone={safeZone} />}
    </AbsoluteFill>
  )
}
