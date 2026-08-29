import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { metricsForDeclination } from '../utils/declination-layout'

interface SceneShellProps {
  scene: PreviewScene
  theme: PreviewTheme
  declination: PreviewDeclination
  children: ReactNode
  style?: CSSProperties
}

export function SceneShell({ scene, theme, declination, children, style }: SceneShellProps): JSX.Element {
  const background = scene.composition.backgroundColor || theme.background
  const justifyContent = scene.composition.layout === 'top' ? 'flex-start' : 'center'
  const alignItems = scene.composition.layout === 'split-right'
    ? 'flex-end'
    : scene.composition.layout === 'split-left'
      ? 'flex-start'
      : 'center'
  const width = scene.composition.layout.startsWith('split-') ? '52%' : '100%'
  const textAlign = scene.composition.layout === 'split-right'
    ? 'right'
    : scene.composition.layout.startsWith('split-')
      ? 'left'
      : 'center'
  const metrics = metricsForDeclination(declination)

  return (
    <AbsoluteFill
      style={{
        background,
        color: theme.text,
        paddingTop: metrics.safeZone.top,
        paddingRight: metrics.safeZone.right,
        paddingBottom: metrics.safeZone.bottom,
        paddingLeft: metrics.safeZone.left,
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          width,
          maxWidth: scene.composition.layout.startsWith('split-') ? undefined : metrics.contentMaxWidth,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent,
          alignItems,
          textAlign,
          gap: metrics.gap,
          marginLeft: scene.composition.layout === 'split-right' ? 'auto' : undefined,
          marginRight: scene.composition.layout === 'split-left' ? 'auto' : undefined,
          ...style
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}
