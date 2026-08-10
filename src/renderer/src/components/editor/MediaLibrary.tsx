import { useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { Upload, Image, AlertTriangle } from 'lucide-react'

export interface MediaViewData {
  id: string
  type: string
  cheminRelatif: string
  nomOriginal: string
  checksum: string
  tailleOctets: number
  mimeType: string
  largeur: number | null
  hauteur: number | null
  statut: string
}

export function MediaLibrary() {
  const projectId = useEditorStore((s) => s.projectId)
  const [medias, setMedias] = useState<MediaViewData[]>([])
  const [loading, setLoading] = useState(false)

  const loadMedias = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const result = await window.electronAPI?.mediaList?.(projectId) as { ok: boolean; data: MediaViewData[] } | undefined
      if (result?.ok) setMedias(result.data)
    } catch (err) {
      console.error('Failed to load media library:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadMedias() }, [loadMedias])

  async function handleImport() {
    if (!projectId) return
    // In a real app, this opens a file dialog via IPC
    // For now, use a simple prompt for testing
    const path = prompt('Chemin complet du fichier à importer :')
    if (!path) return
    try {
      const result = await window.electronAPI?.mediaImport?.({ sourcePath: path, projetId: projectId }) as { ok: boolean; data: MediaViewData } | undefined
      if (result?.ok) {
        await loadMedias()
      } else {
        alert('Import failed')
      }
    } catch (err) {
      console.error('Import error:', err)
    }
  }

  return (
    <div className="media-library-panel">
      <div className="media-library-header">
        <span>Médias ({medias.length})</span>
        <button className="icon-btn" title="Importer un média" onClick={handleImport}>
          <Upload size={14} />
        </button>
      </div>
      <div className="media-list">
        {loading && <p className="media-status">Chargement...</p>}
        {!loading && medias.length === 0 && <p className="media-status">Aucun média importé</p>}
        {medias.map(m => (
          <div key={m.id} className={`media-card ${m.statut === 'manquante' ? 'missing' : ''}`}>
            <div className="media-thumb">
              <Image size={32} />
            </div>
            <div className="media-info">
              <span className="media-name">{m.nomOriginal}</span>
              <span className="media-type">{m.type} — {m.mimeType}</span>
              {m.statut === 'manquante' && <span className="media-missing-badge"><AlertTriangle size={12} /> Manquant</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}