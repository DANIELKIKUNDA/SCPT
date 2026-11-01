export interface DiagramPoint {
  label: string
  value: number
}

export type DiagramKind = 'bar' | 'line'

export interface DiagramSpec {
  kind: DiagramKind
  points: DiagramPoint[]
}

export function parseDiagramSpec(text: string | null): DiagramSpec {
  const lines = text?.split(/\r?\n/) ?? []
  const directive = lines.find((line) => line.trim().length > 0)?.trim().toLowerCase()
  const kind: DiagramKind = directive === '@line' ? 'line' : 'bar'
  const source = kind === 'line' ? lines.filter((line) => line.trim().toLowerCase() !== '@line').join('\n') : text
  return { kind, points: parseDiagramData(source) }
}

export function parseDiagramData(text: string | null): DiagramPoint[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.lastIndexOf(':')
      if (separator <= 0) return null
      const label = line.slice(0, separator).trim()
      const value = Number(line.slice(separator + 1).trim().replace(',', '.'))
      if (!label || !Number.isFinite(value)) return null
      return { label, value }
    })
    .filter((point): point is DiagramPoint => point !== null)
    .slice(0, 10)
}
