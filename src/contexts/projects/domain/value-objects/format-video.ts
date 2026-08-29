export const VIDEO_FORMATS = [
  'HORIZONTAL_16_9',
  'VERTICAL_9_16',
  'CARRE_1_1'
] as const

export type FormatVideoValue = (typeof VIDEO_FORMATS)[number]

export class FormatVideo {
  private constructor(private readonly _value: FormatVideoValue) {}

  static from(value: string): FormatVideo {
    if (!VIDEO_FORMATS.includes(value as FormatVideoValue)) {
      throw new Error(`Invalid FormatVideo: ${value}`)
    }
    return new FormatVideo(value as FormatVideoValue)
  }

  static horizontal(): FormatVideo { return new FormatVideo('HORIZONTAL_16_9') }
  static vertical(): FormatVideo { return new FormatVideo('VERTICAL_9_16') }
  static square(): FormatVideo { return new FormatVideo('CARRE_1_1') }

  get value(): FormatVideoValue { return this._value }
  get aspectRatio(): number {
    if (this._value === 'HORIZONTAL_16_9') return 16 / 9
    if (this._value === 'VERTICAL_9_16') return 9 / 16
    return 1
  }

  get label(): string {
    if (this._value === 'HORIZONTAL_16_9') return '16:9'
    if (this._value === 'VERTICAL_9_16') return '9:16'
    return '1:1'
  }

  equals(other: FormatVideo): boolean { return this._value === other._value }
}
