import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'

export function ImageScene({ scene, theme }: { scene: PreviewScene; theme: PreviewTheme }): JSX.Element {
  const available = scene.media?.statut === 'disponible' && Boolean(scene.media.previewUrl)
  return (
    <SceneShell scene={scene} theme={theme}>
      {scene.titre && <h1 style={{ fontSize: 58, margin: 0 }}>{scene.titre}</h1>}
      {available ? (
        <img
          src={scene.media?.previewUrl ?? undefined}
          alt={scene.media?.nomOriginal ?? 'Média de la scène'}
          style={{
            maxWidth: '100%',
            maxHeight: scene.titre ? 760 : 900,
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
            minHeight: 480,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 20,
            border: `2px dashed ${theme.warning}`,
            color: theme.warning,
            fontSize: 32,
            textAlign: 'center',
            padding: 48
          }}
        >
          {scene.media ? 'Média indisponible ou manquant' : 'Associez une image à cette scène'}
        </div>
      )}
      {scene.texteAffiche && (
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.35, color: theme.mutedText }}>
          {scene.texteAffiche}
        </p>
      )}
    </SceneShell>
  )
}
