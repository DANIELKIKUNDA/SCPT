import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'
import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'

interface SceneShellProps {
  scene: PreviewScene
  theme: PreviewTheme
  children: ReactNode
  style?: CSSProperties
}

export function SceneShell({ scene, theme, children, style }: SceneShellProps): JSX.Element {
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

  return (
    <AbsoluteFill
      style={{
        background,
        color: theme.text,
        padding: '48px 64px',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          width,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent,
          alignItems,
          textAlign,
          gap: 28,
          marginLeft: scene.composition.layout === 'split-right' ? 'auto' : undefined,
          ...style
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}
