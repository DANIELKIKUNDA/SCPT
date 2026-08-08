import { useState, useEffect, useCallback } from 'react'

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
      projects: {
        create: (input: Record<string, unknown>) => Promise<{
          id: string
          titre: string
          type: string
          statut: string
          createdAt: string
        }>
        open: (projectId: string) => Promise<{
          id: string
          titre: string
          type: string
          objectif: string
          publicCible: string
          langueSource: string
          statut: string
          isArchived: boolean
        }>
        listRecent: () => Promise<
          {
            id: string
            titre: string
            type: string
            statut: string
            updatedAt: string
            isArchived: boolean
          }[]
        >
        archive: (projectId: string) => Promise<{ id: string; statut: string }>
        restore: (projectId: string) => Promise<{ id: string; statut: string }>
      }
    }
  }
}

interface ProjectSummary {
  id: string
  titre: string
  type: string
  statut: string
  updatedAt: string
  isArchived: boolean
}

function App(): JSX.Element {
  const [pingStatus, setPingStatus] = useState<string>('verification...')
  const [appInfo, setAppInfo] = useState<string>('chargement...')
  const [theme, setTheme] = useState<string>('system')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formTitre, setFormTitre] = useState('')
  const [formType, setFormType] = useState('')
  const [formObjectif, setFormObjectif] = useState('')
  const [formPublic, setFormPublic] = useState('')
  const [formLangue, setFormLangue] = useState('fr')
  const [formError, setFormError] = useState<string | null>(null)

  const api = window.scpt

  const loadProjects = useCallback(async () => {
    if (!api?.projects) return
    setProjectsLoading(true)
    try {
      const data = await api.projects.listRecent()
      setProjects(data)
    } catch {
      // ignore
    } finally {
      setProjectsLoading(false)
    }
  }, [api])

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
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

      if (!cancelled) await loadProjects()
    }

    init()
    return () => {
      cancelled = true
    }
  }, [api, loadProjects])

  const handleThemeChange = async (newTheme: string): Promise<void> => {
    if (!api) return
    try {
      await api.preferences.set({ theme: newTheme })
      setTheme(newTheme)
    } catch {
      // ignore
    }
  }

  const handleCreateProject = async (): Promise<void> => {
    if (!api?.projects) return
    setFormError(null)

    try {
      await api.projects.create({
        titre: formTitre,
        type: formType,
        objectif: formObjectif,
        publicCible: formPublic,
        langueSource: formLangue
      })
      setShowCreateForm(false)
      setFormTitre('')
      setFormType('')
      setFormObjectif('')
      setFormPublic('')
      await loadProjects()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur de creation')
    }
  }

  const handleArchive = async (projectId: string): Promise<void> => {
    if (!api?.projects) return
    try {
      await api.projects.archive(projectId)
      await loadProjects()
    } catch {
      // ignore
    }
  }

  const handleRestore = async (projectId: string): Promise<void> => {
    if (!api?.projects) return
    try {
      await api.projects.restore(projectId)
      await loadProjects()
    } catch {
      // ignore
    }
  }

  const handleOpen = async (projectId: string): Promise<void> => {
    if (!api?.projects) return
    try {
      const project = await api.projects.open(projectId)
      alert(`Projet ouvert: ${project.titre} (statut: ${project.statut})`)
      await loadProjects()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur ouverture')
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

      <div className="projects-section">
        <div className="projects-header">
          <h3>Projets</h3>
          <button className="btn" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Annuler' : 'Nouveau projet'}
          </button>
        </div>

        {showCreateForm && (
          <form
            className="create-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleCreateProject()
            }}
          >
            {formError && <p className="error-msg">{formError}</p>}
            <input
              placeholder="Titre"
              value={formTitre}
              onChange={(e) => setFormTitre(e.target.value)}
              className="form-input"
              required
            />
            <input
              placeholder="Type (ex: tutoriel, demo)"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="form-input"
              required
            />
            <textarea
              placeholder="Objectif"
              value={formObjectif}
              onChange={(e) => setFormObjectif(e.target.value)}
              className="form-input"
              rows={3}
              required
            />
            <input
              placeholder="Public cible"
              value={formPublic}
              onChange={(e) => setFormPublic(e.target.value)}
              className="form-input"
              required
            />
            <input
              placeholder="Langue source (fr, en...)"
              value={formLangue}
              onChange={(e) => setFormLangue(e.target.value)}
              className="form-input"
              maxLength={10}
              required
            />
            <button type="submit" className="btn btn-primary">
              Creer le projet
            </button>
          </form>
        )}

        {projectsLoading && <p>Chargement des projets...</p>}

        {!projectsLoading && projects.length === 0 && (
          <p className="empty-msg">Aucun projet recent. Creez votre premier projet !</p>
        )}

        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className={`project-item ${p.isArchived ? 'archived' : ''}`}>
              <div className="project-info">
                <strong>{p.titre}</strong>
                <span className="project-meta">
                  {p.type} — {p.statut} — {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="project-actions">
                {!p.isArchived && (
                  <>
                    <button className="btn btn-sm" onClick={() => handleOpen(p.id)}>
                      Ouvrir
                    </button>
                    <button
                      className="btn btn-sm btn-warn"
                      onClick={() => handleArchive(p.id)}
                    >
                      Archiver
                    </button>
                  </>
                )}
                {p.isArchived && (
                  <button
                    className="btn btn-sm btn-restore"
                    onClick={() => handleRestore(p.id)}
                  >
                    Restaurer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default App