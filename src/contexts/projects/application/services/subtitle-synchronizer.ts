import type { SegmentSousTitre } from '../../domain/aggregates/piste-sous-titres'

const TARGET_LINE_LENGTH = 42
const MAX_LINES = 2

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function wrapWords(words: string[]): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= TARGET_LINE_LENGTH || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

function splitParagraph(paragraph: string): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?…;:])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
  const source = sentences.length > 0 ? sentences : [paragraph]
  const blocks: string[] = []

  for (const sentence of source) {
    const words = sentence.split(/\s+/u).filter(Boolean)
    const lines = wrapWords(words)
    for (let index = 0; index < lines.length; index += MAX_LINES) {
      blocks.push(lines.slice(index, index + MAX_LINES).join('\n'))
    }
  }
  return blocks
}

export function splitSubtitleText(text: string): string[] {
  const normalized = normalizeText(text)
  if (!normalized) return []
  return normalized
    .split(/\n{2,}/u)
    .flatMap(splitParagraph)
    .map((block) => block.trim())
    .filter(Boolean)
}

function timingWeight(text: string): number {
  const words = text.replace(/\n/g, ' ').split(/\s+/u).filter(Boolean)
  return Math.max(1, words.reduce((sum, word) => sum + Math.max(1, word.length), 0))
}

export function synchronizeTextToDuration(
  text: string,
  durationMs: number
): Omit<SegmentSousTitre, 'id' | 'ordre'>[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Narration duration must be positive')
  }
  const blocks = splitSubtitleText(text)
  if (blocks.length === 0) throw new Error('Subtitle source text is empty')
  if (durationMs < blocks.length) throw new Error('Narration is too short for subtitle segmentation')

  const weights = blocks.map(timingWeight)
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  let cumulativeWeight = 0
  let cursor = 0

  return blocks.map((block, index) => {
    cumulativeWeight += weights[index]
    const isLast = index === blocks.length - 1
    const proportionalEnd = Math.round((cumulativeWeight / totalWeight) * durationMs)
    const finMs = isLast ? Math.round(durationMs) : Math.max(cursor + 1, proportionalEnd)
    const segment = {
      debutMs: cursor,
      finMs,
      texte: block,
      position: 'bas' as const
    }
    cursor = finMs
    return segment
  })
}
