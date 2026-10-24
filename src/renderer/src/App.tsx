import { useCallback, useEffect, useState } from 'react'
import { Archive, ArrowRight, Clapperboard, Film, FolderOpen, MonitorPlay, Moon, Plus, Settings2, Sparkles, Sun, WandSparkles } from 'lucide-react'
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
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('scpt:onboarding-complete') !== '1')

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


  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.reduceMotion = reduceMotion ? 'true' : 'false'
  }, [reduceMotion, theme])

  async function handleReduceMotionChange(value: boolean): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    try {
      unwrapIpc(await api.preferencesSet({ reduceMotion: value }))
      setReduceMotion(value)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Préférence impossible à enregistrer')
    }
  }

  function completeOnboarding(): void {
    localStorage.setItem('scpt:onboarding-complete', '1')
    setShowOnboarding(false)
  }

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
      <header className="home-topbar">
        <div className="app-wordmark">
          <span className="app-mark"><img src="./scpt-icon.png" alt="" aria-hidden="true" /></span>
          <span><strong>SCPT</strong><small>Studio de Création Pédagogique et Technique</small></span>
        </div>
        <div className="home-topbar-actions">
          <span className={`system-pill ${pingStatus === 'connecte' ? 'online' : ''}`}><span className="system-dot" /> Local · {pingStatus}</span>
          <button className="topbar-icon" title="Préférences" onClick={() => document.getElementById('preferences')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}><Settings2 size={17} /></button>
        </div>
      </header>

      <main className="home-main">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> Studio audiovisuel local-first</span>
            <h1>Transformez vos idées en <span>vidéos qui enseignent, expliquent et convainquent.</span></h1>
            <p>Un espace de production unique pour structurer vos scènes, votre narration, vos médias, vos formats et vos exports — sans quitter votre ordinateur.</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => setShowCreateForm(true)}><Plus size={18} /> Nouveau projet</button>
              <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}><FolderOpen size={18} /> Reprendre un projet</button>
            </div>
            <div className="hero-trust">
              <span>Hors ligne</span><span>Multi-format</span><span>Rendu professionnel</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="studio-card studio-card-main">
              <div className="studio-card-top"><span>APERÇU</span><span>16:9 · 1080p</span></div>
              <div className="studio-stage"><span className="play-orb"><MonitorPlay size={28} /></span><strong>Votre histoire prend forme ici</strong><small>Scènes · Voix · Sous-titres · Médias</small></div>
              <div className="studio-timeline"><i /><i /><i /><i /><i /></div>
            </div>
            <div className="floating-chip chip-one"><Film size={15} /> 9:16 prêt</div>
            <div className="floating-chip chip-two"><WandSparkles size={15} /> Qualité premium</div>
          </div>
        </section>

        {showOnboarding && (
          <section className="onboarding-card" aria-label="Bienvenue dans SCPT">
            <div className="onboarding-icon"><Sparkles size={20} /></div>
            <div className="onboarding-copy"><strong>Bienvenue dans votre studio.</strong><span>Commencez par un projet, construisez vos scènes, puis prévisualisez avant le rendu final.</span></div>
            <div className="onboarding-steps"><span><b>1</b> Projet</span><span><b>2</b> Scènes</span><span><b>3</b> Production</span></div>
            <button className="btn btn-sm" onClick={completeOnboarding}>Compris</button>
          </section>
        )}

        <section className="home-grid">
          <div className="projects-card" id="projects">
            <div className="section-heading">
              <div><span className="section-kicker">ESPACE DE TRAVAIL</span><h2>Vos projets</h2><p>Reprenez une production récente ou démarrez une nouvelle création.</p></div>
              <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}><Plus size={16} /> {showCreateForm ? 'Fermer' : 'Nouveau projet'}</button>
            </div>

            {showCreateForm && (
              <form className="create-form premium-form" onSubmit={(event) => { event.preventDefault(); void handleCreateProject() }}>
                <div className="form-heading"><div><strong>Créer un projet audiovisuel</strong><span>Définissez l’intention. Vous affinerez la mise en scène dans le studio.</span></div></div>
                <div className="form-grid">
                  <label><span>Titre du projet</span><input placeholder="Ex. Comprendre les logarithmes" value={formTitre} onChange={(event) => setFormTitre(event.target.value)} className="form-input" required /></label>
                  <label><span>Type</span><input placeholder="Cours, démonstration, publicité…" value={formType} onChange={(event) => setFormType(event.target.value)} className="form-input" required /></label>
                  <label className="span-2"><span>Objectif</span><textarea placeholder="Quel résultat voulez-vous obtenir ?" value={formObjectif} onChange={(event) => setFormObjectif(event.target.value)} className="form-input" rows={3} required /></label>
                  <label><span>Public cible</span><input placeholder="Ex. Élèves de 4e secondaire" value={formPublic} onChange={(event) => setFormPublic(event.target.value)} className="form-input" required /></label>
                  <label><span>Langue source</span><input placeholder="fr" value={formLangue} onChange={(event) => setFormLangue(event.target.value)} className="form-input" maxLength={10} required /></label>
                </div>
                <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowCreateForm(false)}>Annuler</button><button type="submit" className="btn btn-primary">Créer et ouvrir <ArrowRight size={16} /></button></div>
              </form>
            )}

            {formError && <p className="error-msg" role="alert">{formError}</p>}
            {projectsLoading && <div className="project-skeletons"><i /><i /><i /></div>}
            {!projectsLoading && projects.length === 0 && (
              <div className="empty-state"><span className="empty-illustration"><Clapperboard size={28} /></span><strong>Votre premier projet commence ici.</strong><p>Créez une production pédagogique, technique, institutionnelle ou promotionnelle.</p><button className="btn btn-primary" onClick={() => setShowCreateForm(true)}><Plus size={16} /> Créer mon premier projet</button></div>
            )}
            <ul className="project-list premium-project-list">
              {projects.map((project) => (
                <li key={project.id} className={`project-item ${project.isArchived ? 'archived' : ''}`}>
                  <div className="project-thumbnail"><Film size={20} /></div>
                  <div className="project-info"><strong>{project.titre}</strong><span className="project-meta">{project.type} · {project.statut}</span><span className="project-date">Modifié le {new Date(project.updatedAt).toLocaleDateString()}</span></div>
                  <div className="project-actions">
                    {!project.isArchived ? <><button className="btn btn-sm btn-primary-soft" onClick={() => void openProject(project.id)}>Ouvrir <ArrowRight size={14} /></button><button className="topbar-icon" title="Archiver" onClick={() => void handleArchive(project.id)}><Archive size={15} /></button></> : <button className="btn btn-sm btn-restore" onClick={() => void handleRestore(project.id)}>Restaurer</button>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="settings-card" id="preferences">
            <div className="section-heading compact"><div><span className="section-kicker">CONFORT</span><h2>Préférences</h2></div></div>
            <div className="setting-group"><span>Apparence</span><div className="theme-switcher">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => void handleThemeChange('light')} title="Thème clair"><Sun size={16} /> Clair</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => void handleThemeChange('dark')} title="Thème sombre"><Moon size={16} /> Sombre</button>
              <button className={theme === 'system' ? 'active' : ''} onClick={() => void handleThemeChange('system')} title="Thème système">Auto</button>
            </div></div>
            <label className="setting-toggle"><span><strong>Réduire les animations</strong><small>Améliore le confort visuel.</small></span><input type="checkbox" checked={reduceMotion} onChange={(event) => void handleReduceMotionChange(event.target.checked)} /></label>
            <div className="system-card"><span className="system-card-icon"><MonitorPlay size={18} /></span><div><strong>SCPT est prêt</strong><small>{appInfo}</small></div><span className={`health-dot ${pingStatus === 'connecte' ? 'ok' : ''}`} /></div>
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
