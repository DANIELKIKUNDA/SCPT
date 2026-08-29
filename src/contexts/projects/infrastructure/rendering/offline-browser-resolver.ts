import { existsSync, readdirSync, type Dirent } from 'node:fs'
import { join, resolve } from 'node:path'

function firstExisting(candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return resolve(candidate)
  }
  return null
}

function findProvisionedChromium(root: string, depth = 0): string | null {
  if (depth > 5 || !existsSync(root)) return null
  let entries: Dirent[]
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const absolute = join(root, entry.name)
    if (entry.isFile() && ['thorium.exe', 'chrome.exe'].includes(entry.name.toLowerCase())) return absolute
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findProvisionedChromium(join(root, entry.name), depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Phase 9 must never rely on Remotion's fallback browser download at runtime.
 * This resolver succeeds only with an already available local/provisioned browser.
 */
export function resolveOfflineRenderBrowser(input?: {
  appRoot?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}): string {
  const env = input?.env ?? process.env
  const platform = input?.platform ?? process.platform
  const appRoot = input?.appRoot ?? process.cwd()

  const explicit = firstExisting([
    env.SCPT_RENDER_BROWSER,
    env.PUPPETEER_EXECUTABLE_PATH
  ])
  if (explicit) return explicit

  if (platform === 'win32') {
    const chrome = firstExisting([
      env.PROGRAMFILES ? join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
      env['PROGRAMFILES(X86)'] ? join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
      env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined
    ])
    if (chrome) return chrome
  }

  const provisioned = findProvisionedChromium(join(appRoot, 'node_modules', '.remotion'))
  if (provisioned) return provisioned

  throw new Error('RENDER_BROWSER_UNAVAILABLE')
}
