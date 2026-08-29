/**
 * Phase 8 exposes the single export profile frozen by the MVP visual standard.
 * Encoding is deliberately not implemented here; Phase 10 owns FFmpeg.
 */
export const EXPORT_PROFILES = ['MVP_PREMIUM'] as const
export type ProfilExportValue = (typeof EXPORT_PROFILES)[number]

export class ProfilExport {
  private constructor(private readonly _value: ProfilExportValue) {}

  static from(value: string): ProfilExport {
    if (!EXPORT_PROFILES.includes(value as ProfilExportValue)) {
      throw new Error(`Invalid ProfilExport: ${value}`)
    }
    return new ProfilExport(value as ProfilExportValue)
  }

  static mvpPremium(): ProfilExport { return new ProfilExport('MVP_PREMIUM') }

  get value(): ProfilExportValue { return this._value }
  get label(): string { return 'MVP Premium' }

  equals(other: ProfilExport): boolean { return this._value === other._value }
}
