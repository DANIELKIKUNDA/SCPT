import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import { resolveThemeForBackground, type PreviewTheme } from '../themes/themes'
import { transitionStyle } from '../animations/transitions'
import { TextScene } from './TextScene'
import { FormulaScene } from './FormulaScene'
import { ImageScene } from './ImageScene'
import { CodeScene } from './CodeScene'
import { DiagramScene } from './DiagramScene'

interface SceneRendererProps {
  scene: PreviewScene
  theme: PreviewTheme
  durationInFrames: number
  reduceMotion: boolean
  declination: PreviewDeclination
}

export function SceneRenderer({ scene, theme, durationInFrames, reduceMotion, declination }: SceneRendererProps): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const style = transitionStyle({ frame, durationInFrames, fps, transition: scene.transition, reduceMotion })
  const readableTheme = resolveThemeForBackground(theme, scene.composition.backgroundColor)

  let content: JSX.Element
  switch (scene.type) {
    case 'texte':
      content = <TextScene scene={scene} theme={readableTheme} declination={declination} />
      break
    case 'formule':
      content = <FormulaScene scene={scene} theme={readableTheme} declination={declination} />
      break
    case 'image':
      content = <ImageScene scene={scene} theme={readableTheme} declination={declination} />
      break
    case 'code':
      content = <CodeScene scene={scene} theme={readableTheme} declination={declination} />
      break
    case 'diagramme':
      content = <DiagramScene scene={scene} theme={readableTheme} declination={declination} />
      break
    default: {
      const exhaustive: never = scene.type
      throw new Error(`Unsupported scene type: ${String(exhaustive)}`)
    }
  }

  return <div style={{ width: '100%', height: '100%', ...style }}>{content}</div>
}
