import { BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'

export function FormulaScene({ scene, theme }: { scene: PreviewScene; theme: PreviewTheme }): JSX.Element {
  const formula = scene.texteAffiche?.trim() ?? ''
  return (
    <SceneShell scene={scene} theme={theme}>
      {scene.titre && <h1 style={{ fontSize: 58, margin: 0 }}>{scene.titre}</h1>}
      <div
        style={{
          width: '100%',
          fontSize: 52,
          padding: '36px 44px',
          borderRadius: 22,
          background: theme.surface,
          border: `1px solid ${theme.primary}55`
        }}
      >
        {formula ? (
          <BlockMath
            math={formula}
            renderError={(error) => (
              <div role="alert" style={{ color: theme.error, fontSize: 30, lineHeight: 1.35 }}>
                Formule invalide : {error.message}
              </div>
            )}
          />
        ) : (
          <div style={{ color: theme.mutedText, fontSize: 32 }}>Ajoutez une formule KaTeX.</div>
        )}
      </div>
    </SceneShell>
  )
}
