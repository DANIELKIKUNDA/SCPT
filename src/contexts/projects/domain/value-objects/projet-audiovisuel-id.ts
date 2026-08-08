import { ulid } from 'ulid'

export class ProjetAudiovisuelId {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  static generate(): ProjetAudiovisuelId {
    return new ProjetAudiovisuelId(ulid())
  }

  static from(value: string): ProjetAudiovisuelId {
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
      throw new Error(`Invalid ProjetAudiovisuelId: ${value}`)
    }
    return new ProjetAudiovisuelId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: ProjetAudiovisuelId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}