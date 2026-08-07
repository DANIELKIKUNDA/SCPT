import { z } from 'zod'

export type Theme = z.infer<typeof ThemeSchema>
export const ThemeSchema = z.enum(['system', 'light', 'dark'])

export type Language = z.infer<typeof LanguageSchema>
export const LanguageSchema = z.literal('fr')

export const PreferencesSchema = z.object({
  theme: ThemeSchema.default('system'),
  language: LanguageSchema.default('fr'),
  reduceMotion: z.boolean().default(false)
})

export type Preferences = z.infer<typeof PreferencesSchema>

export const PartialPreferencesSchema = PreferencesSchema.partial()
export type PartialPreferences = z.infer<typeof PartialPreferencesSchema>

export const PreferenceKeySchema = z.enum(['theme', 'language', 'reduceMotion'])
export type PreferenceKey = z.infer<typeof PreferenceKeySchema>