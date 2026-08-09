/** Simple positive integer version for Phase 3. Incremented on each modification. */
export class VersionMetier {
  private constructor(private readonly _value: number) {}

  static initial(): VersionMetier {
    return new VersionMetier(1)
  }

  static from(value: number): VersionMetier {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Invalid VersionMetier: ${value}`)
    }
    return new VersionMetier(value)
  }

  get value(): number {
    return this._value
  }

  next(): VersionMetier {
    return new VersionMetier(this._value + 1)
  }

  equals(other: VersionMetier): boolean {
    return this._value === other._value
  }
}