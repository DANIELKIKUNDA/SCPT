import { app } from 'electron'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  PreferencesSchema,
  type Preferences,
  type PartialPreferences
} from '../../shared/validation/preferences-schema'
import { logger } from '../logging/logger'

const userDataPath = app.getPath('userData')
const prefsPath = join(userDataPath, 'scpt-preferences.json')
const tmpPath = prefsPath + '.tmp'

function readPrefsFromDisk(): Record<string, unknown> {
  if (!existsSync(prefsPath)) return {}
  try {
    const raw = readFileSync(prefsPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    logger.warn('Failed to read preferences file, resetting')
    return {}
  }
}

function writePrefsAtomically(data: Preferences): void {
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  // Clean up any stale tmp file
  try {
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
  } catch {
    // ignore
  }

  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, prefsPath)
}

let cachedPrefs: Preferences | null = null

function loadPrefs(): Preferences {
  const raw = readPrefsFromDisk()
  const result = PreferencesSchema.safeParse(raw)
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'Preferences validation failed, using defaults')
    const defaults: Preferences = { theme: 'system', language: 'fr', reduceMotion: false }
    writePrefsAtomically(defaults)
    return defaults
  }
  return result.data
}

function getPrefs(): Preferences {
  if (!cachedPrefs) {
    cachedPrefs = loadPrefs()
  }
  return cachedPrefs
}

export function getAllPreferences(): Preferences {
  return getPrefs()
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return getPrefs()[key]
}

export function setPreferences(partial: PartialPreferences): Preferences {
  const validated = PreferencesSchema.partial().safeParse(partial)
  if (!validated.success) {
    logger.warn({ issues: validated.error.issues, partial }, 'Invalid partial preferences')
    throw new Error(`Invalid preferences: ${validated.error.issues.map((i) => i.message).join(', ')}`)
  }

  cachedPrefs = { ...getPrefs(), ...validated.data }
  writePrefsAtomically(cachedPrefs)
  return cachedPrefs
}