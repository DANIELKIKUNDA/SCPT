import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Save, Undo2 } from 'lucide-react'
import type { MediaDto, ProjectDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'
import { AutoSave } from './AutoSave'
import { MediaLibrary } from './MediaLibrary'
import { SceneList } from './SceneList'
import { SceneProperties } from './SceneProperties'
import { PreviewPanel } from '../preview/PreviewPanel'
import { NarrationPanel } from '../narration/NarrationPanel'

interface EditorWorkspaceProps {
  project: ProjectDto
  reduceMotion: boolean
  onClose: () => Promise<void>
  onSave: () => Promise<void>
}

export function EditorWorkspace({ project, reduceMotion, onClose, onSave }: EditorWorkspaceProps): JSX.Element {
  const [medias, setMedias] = useState<MediaDto[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [bottomTab, setBottomTab] = useState<'media' | 'narration'>('narration')
  const isDirty = useEditorStore((state) => state.isDirty)
  const error = useEditorStore((state) => state.error)
  const undo = useEditorStore((state) => state.undo)
  const scenes = useEditorStore((state) => state.scenes)
  const setError = useEditorStore((state) => state.setError)

  const loadMedias = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    setMediaLoading(true)
    try {
      setMedias(unwrapIpc(await api.mediaList(project.id)))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Bibliothèque média indisponible')
    } finally {
      setMediaLoading(false)
    }
  }, [project.id, setError])

  useEffect(() => {
    void loadMedias()
  }, [loadMedias])

  return (
    <div className="editor-workspace">
      <AutoSave />

      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <button className="icon-btn labeled" onClick={() => void onClose()} title="Retour aux projets">
            <ChevronLeft size={16} /> Projets
          </button>
          <div className="project-heading">
            <strong>{project.titre}</strong>
            <span>{project.type} · {project.langueSource.toUpperCase()}</span>
          </div>
        </div>

        <div className="editor-topbar-center">
          <span className={`save-status ${isDirty ? 'dirty' : 'saved'}`}>
            <Save size={14} /> {isDirty ? 'Sauvegarde en attente…' : 'Sauvegardé'}
          </span>
          <span className="scene-count">{scenes.length} scène{scenes.length > 1 ? 's' : ''}</span>
        </div>

        <div className="editor-topbar-actions">
          <button
            className="icon-btn labeled"
            onClick={() => void onSave()}
            title="Sauvegarder maintenant"
            disabled={!isDirty}
          >
            <Save size={15} /> Sauvegarder
          </button>
          <button className="icon-btn labeled" onClick={undo} title="Annuler la dernière modification">
            <Undo2 size={15} /> Annuler
          </button>
        </div>
      </header>

      {error && <div className="editor-error" role="alert">{error}</div>}

      <main className="editor-layout">
        <aside className="editor-left"><SceneList /></aside>
        <section className="editor-center"><PreviewPanel medias={medias} reduceMotion={reduceMotion} /></section>
        <aside className="editor-right"><SceneProperties /></aside>
        <section className="editor-bottom">
          <div className="editor-bottom-tabs" role="tablist" aria-label="Outils du projet">
            <button
              className={bottomTab === 'narration' ? 'active' : ''}
              onClick={() => setBottomTab('narration')}
              role="tab"
              aria-selected={bottomTab === 'narration'}
            >Narration</button>
            <button
              className={bottomTab === 'media' ? 'active' : ''}
              onClick={() => setBottomTab('media')}
              role="tab"
              aria-selected={bottomTab === 'media'}
            >Médias</button>
          </div>
          <div className="editor-bottom-content">
            {bottomTab === 'narration' ? (
              <NarrationPanel project={project} scenes={scenes} />
            ) : (
              <MediaLibrary medias={medias} loading={mediaLoading} onRefresh={loadMedias} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
