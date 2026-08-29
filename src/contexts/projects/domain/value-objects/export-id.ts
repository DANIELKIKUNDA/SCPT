import { ulid } from 'ulid'

export class ExportId {
  private constructor(private readonly _value: string) {}

  static generate(): ExportId {
    return new ExportId(ulid())
  }

  static from(value: string): ExportId {
    if (!value || typeof value !== 'string') throw new Error('Invalid ExportId')
    return new ExportId(value)
  }

  get value(): string { return this._value }
  equals(other: ExportId): boolean { return this._value === other._value }
}
