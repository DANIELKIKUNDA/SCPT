import type { ReactNode } from 'react'
import type { PreviewDeclination, PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'
import { metricsForDeclination } from '../utils/declination-layout'

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new',
  'async', 'await', 'import', 'from', 'export', 'interface', 'type', 'public', 'private', 'static'
])

function highlightLine(line: string, theme: PreviewTheme): ReactNode[] {
  const tokens = line.split(/(\s+|[(){}.,;:+*/=<>-]+|(?:\[|\]))/g)
  return tokens.map((token, index) => {
    let color = theme.text
    if (KEYWORDS.has(token)) color = theme.primary
    else if (/^['"`].*['"`]$/.test(token)) color = theme.success
    else if (/^\d+(?:\.\d+)?$/.test(token)) color = theme.accent
    else if (token.trim().startsWith('//')) color = theme.mutedText
    return <span key={`${index}-${token}`} style={{ color }}>{token}</span>
  })
}

export function CodeScene({ scene, theme, declination }: { scene: PreviewScene; theme: PreviewTheme; declination: PreviewDeclination }): JSX.Element {
  const code = scene.texteAffiche ?? ''
  const metrics = metricsForDeclination(declination)
  const maxLines = declination.format === 'VERTICAL_9_16' ? 14 : declination.format === 'CARRE_1_1' ? 16 : 18
  const lines = code.split('\n').slice(0, maxLines)
  return (
    <SceneShell scene={scene} theme={theme} declination={declination}>
      {scene.titre && <h1 style={{ fontSize: metrics.titleFontSize - 8, margin: 0 }}>{scene.titre}</h1>}
      <div
        style={{
          width: '100%',
          background: theme.codeBackground,
          border: `1px solid ${theme.primary}40`,
          borderRadius: 18,
          padding: declination.format === 'VERTICAL_9_16' ? '28px 22px' : '28px 32px',
          fontFamily: 'Cascadia Code, Consolas, monospace',
          fontSize: metrics.codeFontSize,
          lineHeight: 1.45,
          overflow: 'hidden'
        }}
      >
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', minHeight: Math.ceil(metrics.codeFontSize * 1.43) }}>
            <span style={{ color: theme.mutedText, userSelect: 'none' }}>{index + 1}</span>
            <code style={{ whiteSpace: 'pre', overflow: 'hidden' }}>{highlightLine(line, theme)}</code>
          </div>
        ))}
        {!code && <span style={{ color: theme.mutedText }}>Ajoutez du code dans les propriétés.</span>}
      </div>
    </SceneShell>
  )
}
