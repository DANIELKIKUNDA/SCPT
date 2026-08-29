import { BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { DEFAULT_PREVIEW_DECLINATION, metricsForDeclination } from '../utils/declination-layout'

export function FormulaScene({ scene, theme, declination = DEFAULT_PREVIEW_DECLINATION }: { scene: PreviewScene; theme: PreviewTheme; declination?: PreviewDeclination }): JSX.Element {
  const formula = scene.texteAffiche?.trim() ?? ''
  const metrics = metricsForDeclination(declination)
  return (
    <SceneShell scene={scene} theme={theme} declination={declination}>
      {scene.titre && <h1 style={{ fontSize: metrics.titleFontSize, margin: 0 }}>{scene.titre}</h1>}
      <div
        style={{
          width: '100%',
          fontSize: metrics.formulaFontSize,
          padding: declination.format === 'VERTICAL_9_16' ? '40px 28px' : '36px 44px',
          borderRadius: 22,
          background: theme.surface,
          border: `1px solid ${theme.primary}55`,
          overflow: 'hidden'
        }}
      >
        {formula ? (
          <BlockMath
            math={formula}
            renderError={(error) => (
              <div role="alert" style={{ color: theme.error, fontSize: metrics.bodyFontSize, lineHeight: 1.35 }}>
                Formule invalide : {error.message}
              </div>
            )}
          />
        ) : (
          <div style={{ color: theme.mutedText, fontSize: metrics.bodyFontSize }}>Ajoutez une formule KaTeX.</div>
        )}
      </div>
    </SceneShell>
  )
}
