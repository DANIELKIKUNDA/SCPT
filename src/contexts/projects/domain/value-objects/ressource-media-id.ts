import { ulid } from 'ulid'

export class RessourceMediaId {
  private constructor(private readonly _value: string) {}

  static generate(): RessourceMediaId {
    return new RessourceMediaId(ulid())
  }

  static from(value: string): RessourceMediaId {
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
      throw new Error(`Invalid RessourceMediaId: ${value}`)
    }
    return new RessourceMediaId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: RessourceMediaId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}