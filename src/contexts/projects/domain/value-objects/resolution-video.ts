import { FormatVideo } from './format-video'

export interface ResolutionVideoValue {
  width: number
  height: number
}

const CANONICAL_RESOLUTIONS = {
  HORIZONTAL_16_9: { width: 1920, height: 1080 },
  VERTICAL_9_16: { width: 1080, height: 1920 },
  CARRE_1_1: { width: 1080, height: 1080 }
} as const

export class ResolutionVideo {
  private constructor(
    private readonly _width: number,
    private readonly _height: number
  ) {}

  static from(width: number, height: number): ResolutionVideo {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error('Invalid ResolutionVideo')
    }
    if (width > 7680 || height > 7680) throw new Error('ResolutionVideo exceeds supported bounds')
    return new ResolutionVideo(width, height)
  }

  static canonicalFor(format: FormatVideo): ResolutionVideo {
    const preset = CANONICAL_RESOLUTIONS[format.value]
    return new ResolutionVideo(preset.width, preset.height)
  }

  get width(): number { return this._width }
  get height(): number { return this._height }
  get value(): ResolutionVideoValue { return { width: this._width, height: this._height } }

  isCompatibleWith(format: FormatVideo): boolean {
    const target = format.aspectRatio
    const actual = this._width / this._height
    return Math.abs(actual - target) < 0.001
  }

  assertCompatibleWith(format: FormatVideo): void {
    if (!this.isCompatibleWith(format)) {
      throw new Error(`Resolution ${this._width}×${this._height} incompatible with ${format.label}`)
    }
  }

  equals(other: ResolutionVideo): boolean {
    return this._width === other._width && this._height === other._height
  }

  toString(): string { return `${this._width}×${this._height}` }
}
