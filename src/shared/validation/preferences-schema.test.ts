import { describe, it, expect } from 'vitest'
import {
  PreferencesSchema,
  ThemeSchema,
  LanguageSchema,
  PreferenceKeySchema,
  PartialPreferencesSchema
} from './preferences-schema'

describe('PreferencesSchema', () => {
  it('accepte des prefs valides completes', () => {
    const result = PreferencesSchema.safeParse({ theme: 'dark', language: 'fr', reduceMotion: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.theme).toBe('dark')
      expect(result.data.reduceMotion).toBe(true)
    }
  })

  it('applique les valeurs par defaut', () => {
    const result = PreferencesSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.theme).toBe('system')
      expect(result.data.language).toBe('fr')
      expect(result.data.reduceMotion).toBe(false)
    }
  })

  it('rejette un theme invalide', () => {
    const result = PreferencesSchema.safeParse({ theme: 'purple' })
    expect(result.success).toBe(false)
  })

  it('rejette une langue invalide', () => {
    const result = PreferencesSchema.safeParse({ language: 'en' })
    expect(result.success).toBe(false)
  })

  it('rejette reduceMotion non booleen', () => {
    const result = PreferencesSchema.safeParse({ reduceMotion: 'yes' })
    expect(result.success).toBe(false)
  })
})

describe('ThemeSchema', () => {
  it('accepte system', () => expect(ThemeSchema.safeParse('system').success).toBe(true))
  it('accepte light', () => expect(ThemeSchema.safeParse('light').success).toBe(true))
  it('accepte dark', () => expect(ThemeSchema.safeParse('dark').success).toBe(true))
  it('rejette invalid', () => expect(ThemeSchema.safeParse('blue').success).toBe(false))
})

describe('LanguageSchema', () => {
  it('accepte fr', () => expect(LanguageSchema.safeParse('fr').success).toBe(true))
  it('rejette en', () => expect(LanguageSchema.safeParse('en').success).toBe(false))
})

describe('PreferenceKeySchema', () => {
  it('accepte theme', () => expect(PreferenceKeySchema.safeParse('theme').success).toBe(true))
  it('accepte language', () => expect(PreferenceKeySchema.safeParse('language').success).toBe(true))
  it('accepte reduceMotion', () => expect(PreferenceKeySchema.safeParse('reduceMotion').success).toBe(true))
  it('rejette unknown', () => expect(PreferenceKeySchema.safeParse('fontSize').success).toBe(false))
})

describe('PartialPreferencesSchema', () => {
  it('accepte partial valide', () => {
    const result = PartialPreferencesSchema.safeParse({ theme: 'light' })
    expect(result.success).toBe(true)
  })

  it('accepte objet vide', () => {
    const result = PartialPreferencesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejette valeur invalide', () => {
    const result = PartialPreferencesSchema.safeParse({ theme: 42 })
    expect(result.success).toBe(false)
  })
})