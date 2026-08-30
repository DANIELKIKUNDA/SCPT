import { AlertTriangle, Image as ImageIcon, Link2, RefreshCw, Upload } from 'lucide-react'
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
      <div className="media-library-header">
        <span>Médias ({medias.length})</span>
        <div className="media-header-actions">
          <button className="icon-btn" title="Actualiser" onClick={() => void onRefresh()}>
            <RefreshCw size={14} />
          </button>
          <button className="icon-btn" title="Importer un média" onClick={() => void handleImport()}>
            <Upload size={14} />
          </button>
        </div>
      </div>

      <div className="media-list">
        {loading && <p className="media-status">Chargement...</p>}
        {!loading && medias.length === 0 && <p className="media-status">Aucun média importé</p>}
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
              {media.statut === 'manquante' && (
                <span className="media-missing-badge"><AlertTriangle size={12} /> Manquant</span>
              )}
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
