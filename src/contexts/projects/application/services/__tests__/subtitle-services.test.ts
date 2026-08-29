import { describe, expect, it } from 'vitest'
import { formatSrt, formatVtt } from '../subtitle-format'
import { splitSubtitleText, synchronizeTextToDuration } from '../subtitle-synchronizer'
import type { SegmentSousTitre } from '../../../domain/aggregates/piste-sous-titres'

const segments: SegmentSousTitre[] = [
  {
    id: 'a', ordre: 1, debutMs: 0, finMs: 1250,
    texte: 'Énergie & sécurité <priorité>', position: 'bas'
  },
  {
    id: 'b', ordre: 2, debutMs: 1250, finMs: 62_345,
    texte: 'Deuxième ligne', position: 'bas'
  }
]

describe('subtitle synchronization', () => {
  it('splits long narration into at most two lines per block', () => {
    const blocks = splitSubtitleText('Bonjour à tous. Nous allons étudier une notion importante avec un exemple simple et progressif pour bien comprendre le raisonnement.')
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks.every((block) => block.split('\n').length <= 2)).toBe(true)
  })

  it('is deterministic', () => {
    const text = 'Première phrase. Deuxième phrase assez longue pour être découpée proprement.'
    expect(synchronizeTextToDuration(text, 6000)).toEqual(synchronizeTextToDuration(text, 6000))
  })

  it('covers the narration duration without overlaps', () => {
    const result = synchronizeTextToDuration('Un premier point. Un deuxième point. Une conclusion.', 7500)
    expect(result[0].debutMs).toBe(0)
    expect(result.at(-1)?.finMs).toBe(7500)
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].debutMs).toBe(result[index - 1].finMs)
    }
  })

  it('rejects empty source text', () => {
    expect(() => synchronizeTextToDuration('   ', 1000)).toThrow('empty')
  })

  it('rejects invalid narration duration', () => {
    expect(() => synchronizeTextToDuration('Bonjour', 0)).toThrow('positive')
  })
})

describe('subtitle export formatting', () => {
  it('exports canonical SRT timestamps and Unicode text', () => {
    const srt = formatSrt(segments)
    expect(srt).toContain('00:00:00,000 --> 00:00:01,250')
    expect(srt).toContain('00:00:01,250 --> 00:01:02,345')
    expect(srt).toContain('Énergie & sécurité <priorité>')
  })

  it('exports WEBVTT header and dot timestamps', () => {
    const vtt = formatVtt(segments)
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toContain('00:00:00.000 --> 00:00:01.250')
  })

  it('escapes VTT cue markup characters without losing accents', () => {
    const vtt = formatVtt(segments)
    expect(vtt).toContain('Énergie &amp; sécurité &lt;priorité&gt;')
  })
})
