import { ulid } from 'ulid'

export class SceneId {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  static generate(): SceneId {
    return new SceneId(ulid())
  }

  static from(value: string): SceneId {
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
      throw new Error(`Invalid SceneId: ${value}`)
    }
    return new SceneId(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: SceneId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}