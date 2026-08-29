import { ulid } from 'ulid'

export class PisteSousTitresId {
  private constructor(private readonly _value: string) {}

  static generate(): PisteSousTitresId {
    return new PisteSousTitresId(ulid())
  }

  static from(value: string): PisteSousTitresId {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid PisteSousTitresId')
    }
    return new PisteSousTitresId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: PisteSousTitresId): boolean {
    return this._value === other._value
  }
}
