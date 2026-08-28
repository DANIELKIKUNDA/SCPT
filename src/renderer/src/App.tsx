import { useCallback, useEffect, useState } from 'react'
import type { ProjectDto, ProjectSummaryDto } from '../../shared/types/electron-api'
import { EditorWorkspace } from './components/editor/EditorWorkspace'
import { unwrapIpc } from './lib/ipc'
import { useEditorStore } from './stores/editor-store'

function App(): JSX.Element {
  const [pingStatus, setPingStatus] = useState('verification...')
  const [appInfo, setAppInfo] = useState('chargement...')
  const [theme, setTheme] = useState('system')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [activeProject, setActiveProject] = useState<ProjectDto | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formTitre, setFormTitre] = useState('')
  const [formType, setFormType] = useState('')
  const [formObjectif, setFormObjectif] = useState('')
  const [formPublic, setFormPublic] = useState('')
  const [formLangue, setFormLangue] = useState('fr')
  const [formError, setFormError] = useState<string | null>(null)

  const setProjectId = useEditorStore((state) => state.setProjectId)
  const setScenes = useEditorStore((state) => state.setScenes)
  const selectScene = useEditorStore((state) => state.selectScene)
  const setDirty = useEditorStore((state) => state.setDirty)
  const resetEditor = useEditorStore((state) => state.resetEditor)

  const loadProjects = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    setProjectsLoading(true)
    try {
      setProjects(unwrapIpc(await api.projectsListRecent()))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Impossible de charger les projets')
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      const api = window.electronAPI
      if (!api) {
        if (!cancelled) setPingStatus('preload non disponible')
        return
      }

      try {
        const pong = unwrapIpc(await api.systemPing())
        if (!cancelled) setPingStatus(pong.message === 'pong' ? 'connecte' : 'inattendu')
      } catch {
        if (!cancelled) setPingStatus('erreur IPC')
      }

      try {
        const info = unwrapIpc(await api.systemGetAppInfo())
        if (!cancelled) setAppInfo(`${info.name} v${info.version} · Electron ${info.electronVersion}`)
      } catch {
        if (!cancelled) setAppInfo('indisponible')
      }

      try {
        const themePref = unwrapIpc(await api.preferencesGet('theme'))
        const reduceMotionPref = unwrapIpc(await api.preferencesGet('reduceMotion'))
        if (!cancelled) {
          setTheme(String(themePref.value))
          setReduceMotion(Boolean(reduceMotionPref.value))
        }
      } catch {
        // Keep local defaults.
      }

      if (!cancelled) await loadProjects()
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [loadProjects])

  async function handleThemeChange(newTheme: string): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    try {
      unwrapIpc(await api.preferencesSet({ theme: newTheme }))
      setTheme(newTheme)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Préférence impossible à enregistrer')
    }
  }

  async function openProject(projectId: string): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    setFormError(null)

    try {
      const project = unwrapIpc(await api.projectsOpen(projectId))
      try {
        const scenes = unwrapIpc(await api.scenesLoadSequence(projectId))
        setProjectId(projectId)
        setScenes(scenes)
        selectScene(scenes[0]?.id ?? null)
        setActiveProject(project)
      } catch (error) {
        await api.projectsClose(projectId)
        throw error
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erreur ouverture')
    }
  }

  async function handleCreateProject(): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    setFormError(null)

    try {
      const created = unwrapIpc(await api.projectsCreate({
        titre: formTitre,
        type: formType,
        objectif: formObjectif,
        publicCible: formPublic,
        langueSource: formLangue
      }))
      setShowCreateForm(false)
      setFormTitre('')
      setFormType('')
      setFormObjectif('')
      setFormPublic('')
      await loadProjects()
      await openProject(created.id)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erreur de création')
    }
  }

  async function handleArchive(projectId: string): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    try {
      unwrapIpc(await api.projectsArchive(projectId))
      await loadProjects()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Archivage impossible')
    }
  }

  async function handleRestore(projectId: string): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    try {
      unwrapIpc(await api.projectsRestore(projectId))
      await loadProjects()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Restauration impossible')
    }
  }

  async function flushEditor(): Promise<void> {
    const api = window.electronAPI
    const state = useEditorStore.getState()
    if (!api || !state.projectId || !state.isDirty) return

    unwrapIpc(await api.scenesReorder({
      projetId: state.projectId,
      orderedIds: state.scenes.map((scene) => scene.id)
    }))

    for (const scene of state.scenes) {
      unwrapIpc(await api.scenesUpdate({
        sceneId: scene.id,
        projetId: state.projectId,
        titre: scene.titre,
        narrationTexte: scene.narrationTexte,
        texteAffiche: scene.texteAffiche,
        dureeMs: scene.dureeMs,
        composition: scene.composition,
        transition: scene.transition
      }))
    }
    setDirty(false)
  }

  async function closeEditor(): Promise<void> {
    const api = window.electronAPI
    if (!api || !activeProject) return
    setFormError(null)
    try {
      await flushEditor()
      unwrapIpc(await api.projectsClose(activeProject.id))
      resetEditor()
      setActiveProject(null)
      await loadProjects()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Fermeture du projet impossible')
    }
  }

  if (activeProject) {
    return (
      <EditorWorkspace
        project={activeProject}
        reduceMotion={reduceMotion}
        onClose={closeEditor}
        onSave={flushEditor}
      />
    )
  }

  return (
    <div className="home-shell">
      <main className="container">
        <div className="brand-block">
          <h1>SCPT</h1>
          <p className="subtitle">Application de bureau locale</p>
          <div className="info">{appInfo}</div>
        </div>

        <div className="status" aria-label="État technique">
          <div className="status-row"><span className="label">React</span><span className="value ok">fonctionnel</span></div>
          <div className="status-row"><span className="label">Electron</span><span className="value ok">fonctionnel</span></div>
          <div className="status-row">
            <span className="label">IPC Ping</span>
            <span className={`value ${pingStatus === 'connecte' ? 'ok' : 'ko'}`}>{pingStatus}</span>
          </div>
          <div className="status-row"><span className="label">Preferences</span><span className="value ok">accessible</span></div>
        </div>

        <section className="prefs-section">
          <h3>Preferences</h3>
          <div className="pref-row">
            <span className="label">Theme</span>
            <select value={theme} onChange={(event) => void handleThemeChange(event.target.value)} className="pref-select">
              <option value="system">Système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
        </section>

        <section className="projects-section">
          <div className="projects-header">
            <div>
              <h3>Projets</h3>
              <p>Créez ou reprenez une production audiovisuelle.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Annuler' : 'Nouveau projet'}
            </button>
          </div>

          {showCreateForm && (
            <form
              className="create-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreateProject()
              }}
            >
              <input placeholder="Titre" value={formTitre} onChange={(event) => setFormTitre(event.target.value)} className="form-input" required />
              <input placeholder="Type (ex: tutoriel, démonstration)" value={formType} onChange={(event) => setFormType(event.target.value)} className="form-input" required />
              <textarea placeholder="Objectif" value={formObjectif} onChange={(event) => setFormObjectif(event.target.value)} className="form-input" rows={3} required />
              <input placeholder="Public cible" value={formPublic} onChange={(event) => setFormPublic(event.target.value)} className="form-input" required />
              <input placeholder="Langue source (fr, en...)" value={formLangue} onChange={(event) => setFormLangue(event.target.value)} className="form-input" maxLength={10} required />
              <button type="submit" className="btn btn-primary">Créer et ouvrir</button>
            </form>
          )}

          {formError && <p className="error-msg" role="alert">{formError}</p>}
          {projectsLoading && <p>Chargement des projets...</p>}
          {!projectsLoading && projects.length === 0 && <p className="empty-msg">Aucun projet récent. Créez votre premier projet.</p>}

          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id} className={`project-item ${project.isArchived ? 'archived' : ''}`}>
                <div className="project-info">
                  <strong>{project.titre}</strong>
                  <span className="project-meta">
                    {project.type} · {project.statut} · {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="project-actions">
                  {!project.isArchived ? (
                    <>
                      <button className="btn btn-sm" onClick={() => void openProject(project.id)}>Ouvrir</button>
                      <button className="btn btn-sm btn-warn" onClick={() => void handleArchive(project.id)}>Archiver</button>
                    </>
                  ) : (
                    <button className="btn btn-sm btn-restore" onClick={() => void handleRestore(project.id)}>Restaurer</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
