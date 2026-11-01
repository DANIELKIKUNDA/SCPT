import { describe, expect, it } from 'vitest'
import { parseDiagramData, parseDiagramSpec } from './diagram-data'

describe('diagram data', () => {
  it('preserves the historical bar diagram format', () => {
    expect(parseDiagramSpec('Janvier: 12\nFévrier: 18')).toEqual({
      kind: 'bar',
      points: [{ label: 'Janvier', value: 12 }, { label: 'Février', value: 18 }]
    })
  })

  it('supports an explicit line chart for mathematical functions', () => {
    expect(parseDiagramSpec('@line\n0.25: -2\n0.5: -1\n1: 0\n2: 1\n4: 2')).toEqual({
      kind: 'line',
      points: [
        { label: '0.25', value: -2 },
        { label: '0.5', value: -1 },
        { label: '1', value: 0 },
        { label: '2', value: 1 },
        { label: '4', value: 2 }
      ]
    })
  })

  it('keeps rejecting malformed or non-finite points', () => {
    expect(parseDiagramData('sans valeur\nA: infini\nB: 2')).toEqual([{ label: 'B', value: 2 }])
  })
})
