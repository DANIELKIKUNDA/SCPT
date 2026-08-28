import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'

export function TextScene({ scene, theme }: { scene: PreviewScene; theme: PreviewTheme }): JSX.Element {
  return (
    <SceneShell scene={scene} theme={theme}>
      {scene.titre && (
        <h1 style={{ fontSize: 68, lineHeight: 1.08, margin: 0, maxWidth: 1500, letterSpacing: -1 }}>
          {scene.titre}
        </h1>
      )}
      {scene.texteAffiche && (
        <p
          style={{
            fontSize: 36,
            lineHeight: 1.38,
            margin: 0,
            maxWidth: 1500,
            color: theme.mutedText,
            whiteSpace: 'pre-wrap'
          }}
        >
          {scene.texteAffiche}
        </p>
      )}
      {!scene.titre && !scene.texteAffiche && (
        <p style={{ fontSize: 34, color: theme.mutedText }}>Scène texte vide</p>
      )}
    </SceneShell>
  )
}
