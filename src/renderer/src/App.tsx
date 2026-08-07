import { useState, useEffect } from 'react'

declare global {
  interface Window {
    scpt?: {
      system: {
        ping: () => Promise<string>
        getAppInfo: () => Promise<{
          name: string
          version: string
          electronVersion: string
          isDev: boolean
        }>
      }
      preferences: {
        get: (key: 'theme' | 'language' | 'reduceMotion') => Promise<{
          key: string
          value: unknown
        }>
        set: (partial: Record<string, unknown>) => Promise<{
          theme: string
          language: string
          reduceMotion: boolean
        }>
      }
    }
  }
}

function App(): JSX.Element {
  const [pingStatus, setPingStatus] = useState<string>('verification...')
  const [appInfo, setAppInfo] = useState<string>('chargement...')
  const [theme, setTheme] = useState<string>('system')

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      const api = window.scpt
      if (!api) {
        if (!cancelled) setPingStatus('preload non disponible')
        return
      }

      try {
        const pong = await api.system.ping()
        if (!cancelled) setPingStatus(pong === 'pong' ? 'connecte' : 'inattendu')
      } catch {
        if (!cancelled) setPingStatus('erreur IPC')
      }

      try {
        const info = await api.system.getAppInfo()
        if (!cancelled)
          setAppInfo(`${info.name} v${info.version} (Electron ${info.electronVersion})`)
      } catch {
        if (!cancelled) setAppInfo('indisponible')
      }

      try {
        const t = await api.preferences.get('theme')
        if (!cancelled) setTheme(String(t.value))
      } catch {
        // ignore
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const handleThemeChange = async (newTheme: string): Promise<void> => {
    const api = window.scpt
    if (!api) return
    try {
      await api.preferences.set({ theme: newTheme })
      setTheme(newTheme)
    } catch {
      // ignore
    }
  }

  return (
    <div className="container">
      <h1>SCPT</h1>
      <p className="subtitle">Application de bureau locale</p>
      <div className="info">{appInfo}</div>

      <div className="status">
        <div className="status-row">
          <span className="label">React</span>
          <span className="value ok">fonctionnel</span>
        </div>
        <div className="status-row">
          <span className="label">Electron</span>
          <span className="value ok">fonctionnel</span>
        </div>
        <div className="status-row">
          <span className="label">IPC Ping</span>
          <span className={`value ${pingStatus === 'connecte' ? 'ok' : 'ko'}`}>
            {pingStatus}
          </span>
        </div>
        <div className="status-row">
          <span className="label">Preferences</span>
          <span className="value ok">accessible</span>
        </div>
      </div>

      <div className="prefs-section">
        <h3>Preferences</h3>
        <div className="pref-row">
          <span className="label">Theme</span>
          <select
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value)}
            className="pref-select"
          >
            <option value="system">Systeme</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default App