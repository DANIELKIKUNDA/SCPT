import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { parseDiagramData } from './diagram-data'

export function DiagramScene({ scene, theme }: { scene: PreviewScene; theme: PreviewTheme }): JSX.Element {
  const data = parseDiagramData(scene.texteAffiche)
  const isSplit = scene.composition.layout.startsWith('split-')
  const panelWidth = isSplit ? 860 : 1500
  const chartWidth = panelWidth - 64
  return (
    <SceneShell scene={scene} theme={theme}>
      {scene.titre && <h1 style={{ fontSize: 58, margin: 0 }}>{scene.titre}</h1>}
      {data.length > 0 ? (
        <div style={{ width: panelWidth, height: 720, background: theme.surface, borderRadius: 22, padding: 32 }}>
          <BarChart width={chartWidth} height={656} data={data} margin={{ top: 24, right: 24, bottom: 40, left: 20 }}>
            <CartesianGrid stroke={`${theme.mutedText}44`} strokeDasharray="4 6" />
            <XAxis dataKey="label" tick={{ fill: theme.text, fontSize: 25 }} />
            <YAxis tick={{ fill: theme.text, fontSize: 25 }} />
            <Bar dataKey="value" fill={theme.primary} radius={[10, 10, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </div>
      ) : (
        <div
          role="status"
          style={{
            width: '100%',
            minHeight: 460,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 20,
            border: `2px dashed ${theme.primary}88`,
            color: theme.mutedText,
            fontSize: 30,
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
