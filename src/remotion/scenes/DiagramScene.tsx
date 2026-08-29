import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useVideoConfig } from 'remotion'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { metricsForDeclination } from '../utils/declination-layout'
import { parseDiagramData } from './diagram-data'

export function DiagramScene({ scene, theme, declination }: { scene: PreviewScene; theme: PreviewTheme; declination: PreviewDeclination }): JSX.Element {
  const data = parseDiagramData(scene.texteAffiche)
  const metrics = metricsForDeclination(declination)
  const { width, height } = useVideoConfig()
  const availableWidth = Math.min(metrics.contentMaxWidth, width - metrics.safeZone.left - metrics.safeZone.right)
  const panelWidth = scene.composition.layout.startsWith('split-') ? Math.round(availableWidth * 0.52) : availableWidth
  const panelHeight = Math.max(360, Math.round(height * metrics.diagramHeightRatio))
  const chartWidth = Math.max(300, panelWidth - 64)
  const chartHeight = Math.max(280, panelHeight - 64)
  return (
    <SceneShell scene={scene} theme={theme} declination={declination}>
      {scene.titre && <h1 style={{ fontSize: metrics.titleFontSize - 6, margin: 0 }}>{scene.titre}</h1>}
      {data.length > 0 ? (
        <div style={{ width: panelWidth, height: panelHeight, background: theme.surface, borderRadius: 22, padding: 32 }}>
          <BarChart width={chartWidth} height={chartHeight} data={data} margin={{ top: 24, right: 24, bottom: 40, left: 20 }}>
            <CartesianGrid stroke={`${theme.mutedText}44`} strokeDasharray="4 6" />
            <XAxis dataKey="label" tick={{ fill: theme.text, fontSize: declination.format === 'VERTICAL_9_16' ? 28 : 25 }} />
            <YAxis tick={{ fill: theme.text, fontSize: declination.format === 'VERTICAL_9_16' ? 28 : 25 }} />
            <Bar dataKey="value" fill={theme.primary} radius={[10, 10, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </div>
      ) : (
        <div
          role="status"
          style={{
            width: '100%',
            minHeight: Math.round(height * 0.4),
            display: 'grid',
            placeItems: 'center',
            borderRadius: 20,
            border: `2px dashed ${theme.primary}88`,
            color: theme.mutedText,
            fontSize: metrics.bodyFontSize,
            lineHeight: 1.4,
            textAlign: 'center'
          }}
        >
          Saisissez les données sous la forme « Libellé: valeur », une ligne par point.
        </div>
      )}
    </SceneShell>
  )
}
