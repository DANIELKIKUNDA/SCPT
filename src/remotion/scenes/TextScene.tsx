import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { metricsForDeclination } from '../utils/declination-layout'

export function TextScene({ scene, theme, declination }: { scene: PreviewScene; theme: PreviewTheme; declination: PreviewDeclination }): JSX.Element {
  const metrics = metricsForDeclination(declination)
  return (
    <SceneShell scene={scene} theme={theme} declination={declination}>
      {scene.titre && (
        <h1 style={{ fontSize: metrics.titleFontSize, lineHeight: 1.08, margin: 0, maxWidth: metrics.contentMaxWidth, letterSpacing: -1 }}>
          {scene.titre}
        </h1>
      )}
      {scene.texteAffiche && (
        <p
          style={{
            fontSize: metrics.bodyFontSize,
            lineHeight: 1.38,
            margin: 0,
            maxWidth: metrics.contentMaxWidth,
            color: theme.mutedText,
            whiteSpace: 'pre-wrap'
          }}
        >
          {scene.texteAffiche}
        </p>
      )}
      {!scene.titre && !scene.texteAffiche && (
        <p style={{ fontSize: metrics.bodyFontSize, color: theme.mutedText }}>Scène texte vide</p>
      )}
    </SceneShell>
  )
}
