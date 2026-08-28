import type { PreviewThemeId } from '../types/preview-types'

export interface PreviewTheme {
  id: PreviewThemeId
  background: string
  surface: string
  primary: string
  secondary: string
  accent: string
  text: string
  mutedText: string
  success: string
  warning: string
  error: string
  codeBackground: string
}

export const PREVIEW_THEMES: Record<PreviewThemeId, PreviewTheme> = {
  dark: {
    id: 'dark',
    background: '#0b1020',
    surface: '#151c2f',
    primary: '#5b8cff',
    secondary: '#8da7ff',
    accent: '#43d4b5',
    text: '#f5f7fb',
    mutedText: '#b3bdd2',
    success: '#3ccf91',
    warning: '#f4bf4f',
    error: '#ff6b77',
    codeBackground: '#0d1324'
  },
  light: {
    id: 'light',
    background: '#f7f9fd',
    surface: '#ffffff',
    primary: '#245dcc',
    secondary: '#5577aa',
    accent: '#0f8f7a',
    text: '#172033',
    mutedText: '#59677f',
    success: '#198754',
    warning: '#996c00',
    error: '#c43645',
    codeBackground: '#eef2f8'
  }
}

function normalizeHexColor(value: string): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  return match ? match[1] : null
}

function isDarkBackground(value: string): boolean {
  const hex = normalizeHexColor(value)
  if (!hex) return true
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255
  // Relative luminance approximation is sufficient for choosing a readable
  // preview palette; it is deterministic and does not rely on DOM measurement.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.55
}

/**
 * Preserve the selected theme's identity/accent while adapting neutral colors to
 * an explicit per-scene background. This prevents a light theme from producing
 * dark text on a custom dark background (and the inverse).
 */
export function resolveThemeForBackground(theme: PreviewTheme, backgroundColor: string): PreviewTheme {
  if (isDarkBackground(backgroundColor)) {
    return {
      ...theme,
      surface: '#151c2f',
      text: '#f5f7fb',
      mutedText: '#b3bdd2',
      codeBackground: '#0d1324'
    }
  }

  return {
    ...theme,
    surface: '#ffffff',
    text: '#172033',
    mutedText: '#59677f',
    codeBackground: '#eef2f8'
  }
}
