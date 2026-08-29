import { ulid } from 'ulid'

/**
 * Identifier allocated by Phase 7 for the master 16:9 subtitle scope.
 * Phase 8 will materialize the matching audiovisual declination without
 * changing the subtitle aggregate contract.
 */
export class DeclinaisonId {
  private constructor(private readonly _value: string) {}

  static generate(): DeclinaisonId {
    return new DeclinaisonId(ulid())
  }

  static from(value: string): DeclinaisonId {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid DeclinaisonId')
    }
    return new DeclinaisonId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: DeclinaisonId): boolean {
    return this._value === other._value
  }
}
