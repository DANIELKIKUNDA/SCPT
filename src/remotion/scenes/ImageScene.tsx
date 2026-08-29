import { useVideoConfig } from 'remotion'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { metricsForDeclination } from '../utils/declination-layout'

export function ImageScene({ scene, theme, declination }: { scene: PreviewScene; theme: PreviewTheme; declination: PreviewDeclination }): JSX.Element {
  const available = scene.media?.statut === 'disponible' && Boolean(scene.media.previewUrl)
  const metrics = metricsForDeclination(declination)
  const { height } = useVideoConfig()
  return (
    <SceneShell scene={scene} theme={theme} declination={declination}>
      {scene.titre && <h1 style={{ fontSize: metrics.titleFontSize, margin: 0 }}>{scene.titre}</h1>}
      {available ? (
        <img
          src={scene.media?.previewUrl ?? undefined}
          alt={scene.media?.nomOriginal ?? 'Média de la scène'}
          style={{
            maxWidth: '100%',
            maxHeight: Math.round(height * metrics.imageMaxHeightRatio),
            objectFit: 'contain',
            borderRadius: 20,
            boxShadow: '0 18px 60px rgba(0,0,0,0.28)'
          }}
        />
      ) : (
        <div
          role="status"
          style={{
            width: '100%',
            minHeight: Math.round(height * 0.35),
            display: 'grid',
            placeItems: 'center',
            borderRadius: 20,
            border: `2px dashed ${theme.warning}`,
            color: theme.warning,
            fontSize: metrics.bodyFontSize,
            textAlign: 'center',
            padding: 48
          }}
        >
          {scene.media ? 'Média indisponible ou manquant' : 'Associez une image à cette scène'}
        </div>
      )}
      {scene.texteAffiche && (
        <p style={{ margin: 0, fontSize: Math.max(28, metrics.bodyFontSize - 4), lineHeight: 1.35, color: theme.mutedText }}>
          {scene.texteAffiche}
        </p>
      )}
    </SceneShell>
  )
}
