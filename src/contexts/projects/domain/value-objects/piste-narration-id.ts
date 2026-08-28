import { ulid } from 'ulid'

export class PisteNarrationId {
  private constructor(private readonly _value: string) {}

  static generate(): PisteNarrationId {
    return new PisteNarrationId(ulid())
  }

  static from(value: string): PisteNarrationId {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid PisteNarrationId')
    }
    return new PisteNarrationId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: PisteNarrationId): boolean {
    return this._value === other._value
  }
}
