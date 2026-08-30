import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Save, Undo2 } from 'lucide-react'
import type { DeclinaisonDto, MediaDto, ProjectDto, SubtitleTrackDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'
import { AutoSave } from './AutoSave'
import { MediaLibrary } from './MediaLibrary'
import { SceneList } from './SceneList'
import { SceneProperties } from './SceneProperties'
import { PreviewPanel } from '../preview/PreviewPanel'
import { NarrationPanel } from '../narration/NarrationPanel'
import { SubtitlePanel } from '../subtitles/SubtitlePanel'
import { DeclinationPanel } from '../declinaisons/DeclinationPanel'
import { RenderingPanel } from '../rendering/RenderingPanel'
import { FinalExportPanel } from '../final-export/FinalExportPanel'
import { ReliabilityPanel } from '../reliability/ReliabilityPanel'

interface EditorWorkspaceProps {
  project: ProjectDto
  reduceMotion: boolean
  onClose: () => Promise<void>
  onSave: () => Promise<void>
}

export function EditorWorkspace({ project, reduceMotion, onClose, onSave }: EditorWorkspaceProps): JSX.Element {
  const [medias, setMedias] = useState<MediaDto[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrackDto | null>(null)
  const [showSubtitles, setShowSubtitles] = useState(true)
  const [declinaisons, setDeclinaisons] = useState<DeclinaisonDto[]>([])
  const [selectedDeclinaisonId, setSelectedDeclinaisonId] = useState<string | null>(null)
  const [sourceRevision, setSourceRevision] = useState(0)
  const [bottomTab, setBottomTab] = useState<'media' | 'narration' | 'subtitles' | 'declinaisons' | 'rendering' | 'final-export' | 'reliability'>('narration')
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

  const loadSubtitles = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    try {
      setSubtitleTrack(unwrapIpc(await api.subtitlesGet({ projectId: project.id, langue: project.langueSource })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Sous-titres indisponibles')
    }
  }, [project.id, project.langueSource, setError])

  const loadDeclinaisons = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    try {
      const items = unwrapIpc(await api.declinaisonsList(project.id))
      setDeclinaisons(items)
      setSelectedDeclinaisonId((current) => {
        if (current && items.some((item) => item.id === current && !item.obsolete)) return current
        return items.find((item) => !item.obsolete)?.id ?? null
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Déclinaisons indisponibles')
    }
  }, [project.id, setError])

  useEffect(() => {
    void loadMedias()
    void loadSubtitles()
    void loadDeclinaisons()
  }, [loadDeclinaisons, loadMedias, loadSubtitles])

  const handleNarrationTrackChange = useCallback((): void => {
    void loadSubtitles()
    setSourceRevision((value) => value + 1)
  }, [loadSubtitles])

  const handleSubtitleTrackChange = useCallback((track: SubtitleTrackDto): void => {
    setSubtitleTrack(track)
    setSourceRevision((value) => value + 1)
  }, [])

  const handleDeclinaisonChanged = useCallback((updated: DeclinaisonDto): void => {
    setDeclinaisons((current) => {
      const without = current.filter((item) => item.id !== updated.id)
      return [...without, updated]
    })
  }, [])

  const selectedDeclinaison = declinaisons.find((item) => item.id === selectedDeclinaisonId && !item.obsolete) ?? null

  useEffect(() => {
    if (bottomTab !== 'declinaisons') return
    const timer = window.setTimeout(() => { void loadDeclinaisons() }, 1850)
    return () => window.clearTimeout(timer)
  }, [bottomTab, loadDeclinaisons, scenes, sourceRevision])

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
        <section className="editor-center"><PreviewPanel medias={medias} reduceMotion={reduceMotion} subtitles={subtitleTrack} showSubtitles={showSubtitles} declination={selectedDeclinaison} /></section>
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
              className={bottomTab === 'subtitles' ? 'active' : ''}
              onClick={() => setBottomTab('subtitles')}
              role="tab"
              aria-selected={bottomTab === 'subtitles'}
            >Sous-titres</button>
            <button
              className={bottomTab === 'media' ? 'active' : ''}
              onClick={() => setBottomTab('media')}
              role="tab"
              aria-selected={bottomTab === 'media'}
            >Médias</button>
            <button
              className={bottomTab === 'declinaisons' ? 'active' : ''}
              onClick={() => setBottomTab('declinaisons')}
              role="tab"
              aria-selected={bottomTab === 'declinaisons'}
            >Formats</button>
            <button
              className={bottomTab === 'rendering' ? 'active' : ''}
              onClick={() => setBottomTab('rendering')}
              role="tab"
              aria-selected={bottomTab === 'rendering'}
            >Rendus</button>
            <button
              className={bottomTab === 'final-export' ? 'active' : ''}
              onClick={() => setBottomTab('final-export')}
              role="tab"
              aria-selected={bottomTab === 'final-export'}
            >Export final</button>
            <button
              className={bottomTab === 'reliability' ? 'active' : ''}
              onClick={() => setBottomTab('reliability')}
              role="tab"
              aria-selected={bottomTab === 'reliability'}
            >Fiabilité</button>
          </div>
          <div className="editor-bottom-content">
            {bottomTab === 'narration' ? (
              <NarrationPanel project={project} scenes={scenes} onTrackChange={handleNarrationTrackChange} />
            ) : bottomTab === 'subtitles' ? (
              <SubtitlePanel
                project={project}
                scenes={scenes}
                track={subtitleTrack}
                showInPreview={showSubtitles}
                onShowInPreviewChange={setShowSubtitles}
                onTrackChange={handleSubtitleTrackChange}
              />
            ) : bottomTab === 'declinaisons' ? (
              <DeclinationPanel
                project={project}
                scenes={scenes}
                declinaisons={declinaisons}
                selectedId={selectedDeclinaisonId}
                onSelect={(value) => setSelectedDeclinaisonId(value?.id ?? null)}
                onRefresh={loadDeclinaisons}
                onChanged={handleDeclinaisonChanged}
                sourceDirty={isDirty}
              />
            ) : bottomTab === 'rendering' ? (
              <RenderingPanel project={project} declinaisons={declinaisons} />
            ) : bottomTab === 'final-export' ? (
              <FinalExportPanel project={project} declinaisons={declinaisons} />
            ) : bottomTab === 'reliability' ? (
              <ReliabilityPanel project={project} onRestored={onClose} />
            ) : (
              <MediaLibrary medias={medias} loading={mediaLoading} onRefresh={loadMedias} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
