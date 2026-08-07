import { useState, useEffect } from 'react'

declare global {
  interface Window {
    scpt?: {
      system: {
        ping: () => string
      }
    }
  }
}

function App(): JSX.Element {
  const [preloadStatus, setPreloadStatus] = useState<string>('vérification…')

  useEffect(() => {
    try {
      if (window.scpt?.system?.ping) {
        const result = window.scpt.system.ping()
        if (result === 'pong') {
          setPreloadStatus('connecté')
        } else {
          setPreloadStatus('réponse inattendue')
        }
      } else {
        setPreloadStatus('non disponible')
      }
    } catch {
      setPreloadStatus('erreur')
    }
  }, [])

  return (
    <div className="container">
      <h1>SCPT</h1>
      <p className="subtitle">Application de bureau locale</p>
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
          <span className="label">Preload</span>
          <span className={`value ${preloadStatus === 'connecté' ? 'ok' : 'ko'}`}>
            {preloadStatus}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App