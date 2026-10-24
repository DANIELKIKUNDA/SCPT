import { AlertTriangle, FileImage, Image as ImageIcon, Link2, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import type { MediaDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'

interface MediaLibraryProps {
  medias: MediaDto[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export function MediaLibrary({ medias, loading, onRefresh }: MediaLibraryProps): JSX.Element {
  const projectId = useEditorStore((state) => state.projectId)
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId)
  const selectedSceneType = useEditorStore((state) =>
    state.scenes.find((scene) => scene.id === state.selectedSceneId)?.type ?? null
  )
  const setSceneMedia = useEditorStore((state) => state.setSceneMedia)
  const setError = useEditorStore((state) => state.setError)

  async function handleImport(): Promise<void> {
    if (!projectId || !window.electronAPI) return
    const sourcePath = prompt('Chemin complet du fichier à importer :')
    if (!sourcePath) return

    setError(null)
    try {
      unwrapIpc(await window.electronAPI.mediaImport({ sourcePath, projetId: projectId }))
      await onRefresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import média impossible')
    }
  }

  async function handleAssociate(mediaId: string): Promise<void> {
    if (!projectId || !selectedSceneId || !window.electronAPI) return
    setError(null)
    try {
      unwrapIpc(await window.electronAPI.mediaAssociate({
        sceneId: selectedSceneId,
        mediaId,
        projetId: projectId
      }))
      setSceneMedia(selectedSceneId, mediaId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Association média impossible')
    }
  }


  async function handleRights(mediaId: string, droits: MediaDto['droits']): Promise<void> {
    if (!projectId || !window.electronAPI) return
    setError(null)
    try {
      unwrapIpc(await window.electronAPI.mediaUpdateRights({ mediaId, projetId: projectId, droits }))
      await onRefresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Mise à jour des droits impossible')
    }
  }
  async function handleReplace(mediaId: string): Promise<void> {
    if (!projectId || !window.electronAPI) return
    const sourcePath = prompt('Chemin complet du fichier de remplacement :')
    if (!sourcePath) return
    setError(null)
    try {
      unwrapIpc(await window.electronAPI.mediaReplace({ mediaId, projetId: projectId, sourcePath }))
      await onRefresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Remplacement impossible')
    }
  }

  return (
    <section className="media-library-panel" aria-label="Bibliothèque média">
      <div className="tool-stage-banner media-stage-banner">
        <div className="tool-stage-copy">
          <span className="tool-stage-kicker">BIBLIOTHÈQUE DU PROJET</span>
          <strong>Préparez les visuels avant la mise en scène.</strong>
          <small>Importez vos ressources, vérifiez leurs droits puis associez-les à la scène image sélectionnée.</small>
        </div>
        <div className="tool-stage-metrics" aria-label="État des médias">
          <span><b>{medias.length}</b> ressources</span>
          <span className={medias.some((media) => media.statut === 'manquante') ? 'is-warning' : 'is-ready'}><b>{medias.filter((media) => media.statut === 'manquante').length}</b> manquantes</span>
          <span className={medias.some((media) => media.droits === 'inconnue' || media.droits === 'interdite') ? 'is-warning' : 'is-ready'}><b>{medias.filter((media) => media.droits === 'inconnue' || media.droits === 'interdite').length}</b> droits à revoir</span>
        </div>
      </div>

      <div className="media-library-header">
        <span>Ressources ({medias.length})</span>
        <div className="media-header-actions">
          <button className="icon-btn" title="Actualiser" onClick={() => void onRefresh()}>
            <RefreshCw size={14} />
          </button>
          <button className="icon-btn" title="Importer un média" onClick={() => void handleImport()}>
            <Upload size={14} />
          </button>
        </div>
      </div>

      <div className="media-list" aria-live="polite">
        {loading && (
          <div className="tool-loading-state" role="status">
            <span className="tool-spinner" aria-hidden="true" />
            <div><strong>Ouverture de la bibliothèque…</strong><small>SCPT vérifie les ressources du projet.</small></div>
          </div>
        )}
        {!loading && medias.length === 0 && (
          <div className="tool-empty-state">
            <span className="tool-empty-icon"><FileImage size={24} /></span>
            <div><strong>Aucun média dans ce projet</strong><small>Importez une image ou un logo pour commencer à enrichir vos scènes.</small></div>
            <button className="btn btn-primary" onClick={() => void handleImport()}><Upload size={14} /> Importer un média</button>
          </div>
        )}
        {medias.map((media) => {
          const canAssociate = selectedSceneType === 'image' && ['image', 'logo'].includes(media.type)
          return (
          <article key={media.id} className={`media-card ${media.statut === 'manquante' ? 'missing' : ''}`}>
            <div className="media-thumb">
              {media.previewUrl && media.type === 'image' ? (
                <img src={media.previewUrl} alt="" />
              ) : (
                <ImageIcon size={28} />
              )}
            </div>
            <div className="media-info">
              <span className="media-name" title={media.nomOriginal}>{media.nomOriginal}</span>
              <span className="media-type">{media.type} · {media.mimeType}</span>
              <div className="media-badges">
                {media.statut === 'manquante' && (
                  <span className="media-missing-badge"><AlertTriangle size={12} /> Manquant</span>
                )}
                <span className={`media-rights-badge rights-${media.droits}`}><ShieldCheck size={11} /> {media.droits}</span>
              </div>
            </div>
            <div className="media-card-actions">
              <label className="media-rights-control" title="Droits requis pour l’export final">
                <span>Droits</span>
                <select
                  value={media.droits}
                  onChange={(event) => void handleRights(media.id, event.target.value as MediaDto['droits'])}
                >
                  <option value="inconnue">Inconnus</option>
                  <option value="originale">Original</option>
                  <option value="autorisee">Autorisé</option>
                  <option value="libre">Libre</option>
                  <option value="interdite">Interdit</option>
                </select>
              </label>
              {media.statut === 'manquante' ? (
                <button className="btn btn-sm" onClick={() => void handleReplace(media.id)}>Remplacer</button>
              ) : (
                <button
                  className="btn btn-sm"
                  disabled={!selectedSceneId || !canAssociate}
                  onClick={() => void handleAssociate(media.id)}
                  title={!selectedSceneId
                    ? 'Sélectionnez une scène'
                    : selectedSceneType !== 'image'
                      ? 'Phase 5 : l’association visuelle est disponible pour les scènes image'
                      : canAssociate
                        ? 'Associer à la scène image sélectionnée'
                        : 'Sélectionnez un média image compatible'}
                >
                  <Link2 size={13} /> Associer
                </button>
              )}
            </div>
          </article>
          )
        })}
      </div>
    </section>
  )
}
