import type { ReactNode } from 'react'
import type { PreviewScene } from '../types/preview-types'
import type { PreviewTheme } from '../themes/themes'
import { SceneShell } from '../components/SceneShell'

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

export function CodeScene({ scene, theme }: { scene: PreviewScene; theme: PreviewTheme }): JSX.Element {
  const code = scene.texteAffiche ?? ''
  const lines = code.split('\n').slice(0, 18)
  return (
    <SceneShell scene={scene} theme={theme}>
      {scene.titre && <h1 style={{ fontSize: 54, margin: 0 }}>{scene.titre}</h1>}
      <div
        style={{
          width: '100%',
          background: theme.codeBackground,
          border: `1px solid ${theme.primary}40`,
          borderRadius: 18,
          padding: '28px 32px',
          fontFamily: 'Cascadia Code, Consolas, monospace',
          fontSize: 30,
          lineHeight: 1.45,
          overflow: 'hidden'
        }}
      >
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', minHeight: 43 }}>
            <span style={{ color: theme.mutedText, userSelect: 'none' }}>{index + 1}</span>
            <code style={{ whiteSpace: 'pre' }}>{highlightLine(line, theme)}</code>
          </div>
        ))}
        {!code && <span style={{ color: theme.mutedText }}>Ajoutez du code dans les propriétés.</span>}
      </div>
    </SceneShell>
  )
}
