import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, FileText, FolderOpen, Play, RefreshCw, RotateCcw, Video } from 'lucide-react'
import type { DeclinaisonDto, FinalExportDto, ProjectDto, RenderJobDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'

interface FinalExportPanelProps {
  project: ProjectDto
  declinaisons: DeclinaisonDto[]
}

const STATUS_LABELS: Record<FinalExportDto['statut'], string> = {
  demande: 'Demandé',
  en_attente: 'En attente',
  en_preparation: 'Préparation',
  en_encodage: 'Encodage FFmpeg',
  en_verification: 'Vérification FFprobe',
  termine: 'Terminé',
  echoue: 'Échoué',
  annule: 'Annulé'
}


function formatLabel(format: DeclinaisonDto['format']): string {
  if (format === 'VERTICAL_9_16') return '9:16'
  if (format === 'CARRE_1_1') return '1:1'
  return '16:9'
}

function humanBytes(value: number): string {
  if (value < 1024) return `${value} o`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`
  return `${(value / 1024 / 1024).toFixed(1)} Mo`
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 100) / 10
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`
}

export function FinalExportPanel({ project, declinaisons }: FinalExportPanelProps): JSX.Element {
  const [renders, setRenders] = useState<RenderJobDto[]>([])
  const [exports, setExports] = useState<FinalExportDto[]>([])
  const [selectedRenderId, setSelectedRenderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<{ exportId: string; content: string } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    setLoading(true)
    try {
      const [renderItems, finalItems] = await Promise.all([
        api.renderList(project.id),
        api.finalExportList(project.id)
      ])
      const completedRenders = unwrapIpc(renderItems).filter((item) => item.statut === 'termine' && item.cheminFichier)
      const finalExports = unwrapIpc(finalItems)
      setRenders(completedRenders)
      setExports(finalExports)
      setSelectedRenderId((current) => {
        if (current && completedRenders.some((item) => item.id === current)) return current
        return completedRenders[0]?.id ?? ''
      })
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Exports finaux indisponibles')
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => { void load() }, [load])

  const hasActive = exports.some((item) => item.actif)
  useEffect(() => {
    if (!hasActive) return
    const timer = window.setInterval(() => { void load() }, 1000)
    return () => window.clearInterval(timer)
  }, [hasActive, load])

  const latestByRender = useMemo(() => {
    const map = new Map<string, FinalExportDto>()
    for (const item of exports) if (!map.has(item.renderJobId)) map.set(item.renderJobId, item)
    return map
  }, [exports])

  async function startExport(): Promise<void> {
    if (!selectedRenderId || !window.electronAPI) return
    setError(null)
    try {
      unwrapIpc(await window.electronAPI.finalExportStart({ projectId: project.id, renderJobId: selectedRenderId }))
      await load()
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Export final impossible')
    }
  }

  async function cancelExport(item: FinalExportDto): Promise<void> {
    if (!window.electronAPI) return
    try {
      unwrapIpc(await window.electronAPI.finalExportCancel({ projectId: project.id, exportId: item.id }))
      await load()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Annulation impossible')
    }
  }

  async function retryExport(item: FinalExportDto): Promise<void> {
    if (!window.electronAPI) return
    try {
      unwrapIpc(await window.electronAPI.finalExportRetry({ projectId: project.id, exportId: item.id }))
      await load()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Relance impossible')
    }
  }

  async function openFile(item: FinalExportDto): Promise<void> {
    if (!window.electronAPI) return
    try { unwrapIpc(await window.electronAPI.finalExportOpenFile({ projectId: project.id, exportId: item.id })) }
    catch (openError) { setError(openError instanceof Error ? openError.message : 'Ouverture impossible') }
  }

  async function showInFolder(item: FinalExportDto): Promise<void> {
    if (!window.electronAPI) return
    try { unwrapIpc(await window.electronAPI.finalExportShowInFolder({ projectId: project.id, exportId: item.id })) }
    catch (folderError) { setError(folderError instanceof Error ? folderError.message : 'Dossier indisponible') }
  }

  async function showDiagnostic(item: FinalExportDto): Promise<void> {
    if (!window.electronAPI) return
    try {
      const result = unwrapIpc(await window.electronAPI.finalExportReadLog({ projectId: project.id, exportId: item.id }))
      setDiagnostic({ exportId: item.id, content: result.content })
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : 'Diagnostic indisponible')
    }
  }

  return (
    <section className="final-export-panel studio-tool-panel" aria-label="Export final MP4">
      <div className="tool-stage-banner">
        <div><span className="tool-stage-kicker">06 · LIVRAISON</span><strong>Master MP4 prêt à publier</strong><small>Encodez, contrôlez et conservez chaque export final avec ses preuves techniques et son empreinte SHA-256.</small></div>
        <div className="tool-stage-metrics"><span><b>{renders.length}</b> rendus</span><span><b>{exports.filter((item) => item.statut === 'termine').length}</b> masters</span><span className={!hasActive ? 'is-ready' : ''}><b>{hasActive ? '●' : '✓'}</b> {hasActive ? 'encodage' : 'disponible'}</span></div>
      </div>
      <div className="final-export-header">
        <div>
          <h3>Export final MP4</h3>
          <p>H.264 · AAC 48 kHz · 30 fps · normalisation -16 LUFS · vérification FFprobe</p>
        </div>
        <button className="icon-btn" title="Actualiser" onClick={() => void load()}><RefreshCw size={14} /></button>
      </div>

      {error && <div className="final-export-error" role="alert">{error}</div>}

      <div className="final-export-create">
        <label>
          <span>Rendu intermédiaire validé</span>
          <select value={selectedRenderId} onChange={(event) => setSelectedRenderId(event.target.value)} disabled={renders.length === 0}>
            {renders.length === 0 && <option value="">Aucun rendu terminé</option>}
            {renders.map((render) => {
              const declinaison = declinaisons.find((item) => item.id === render.declinaisonId)
              const last = latestByRender.get(render.id)
              return (
                <option key={render.id} value={render.id}>
                  {declinaison ? formatLabel(declinaison.format) : render.declinaisonId.slice(-6)} · tentative {render.tentative}{last?.statut === 'termine' ? ' · déjà exporté' : ''}
                </option>
              )
            })}
          </select>
        </label>
        <button className="btn btn-primary" disabled={!selectedRenderId || hasActive || loading} onClick={() => void startExport()}>
          <Video size={15} /> Créer le MP4 final
        </button>
      </div>

      {renders.length === 0 && !loading && (
        <p className="final-export-empty">Produisez d’abord un rendu intermédiaire dans l’onglet Rendus.</p>
      )}

      <div className="final-export-list">
        {exports.map((item) => {
          const declinaison = declinaisons.find((candidate) => candidate.id === item.declinaisonId)
          return (
            <article key={item.id} className={`final-export-card status-${item.statut}`}>
              <div className="final-export-card-head">
                <div>
                  <strong>{declinaison ? formatLabel(declinaison.format) : 'Format'} · MP4 final</strong>
                  <span>Tentative {item.tentative} · {STATUS_LABELS[item.statut]}</span>
                </div>
                <span className="final-export-progress-value">{item.progression}%</span>
              </div>
              <div className="final-export-progress" aria-label={`Progression ${item.progression}%`}>
                <div style={{ width: `${item.progression}%` }} />
              </div>

              {item.technique && (
                <div className="final-export-tech">
                  <p><CheckCircle2 size={14} /> <strong>{item.technique.nomFichier}</strong></p>
                  <div className="final-export-tech-grid">
                    <span>{item.technique.largeur}×{item.technique.hauteur}</span>
                    <span>{item.technique.fps.toFixed(0)} fps</span>
                    <span>{item.technique.codecVideo.toUpperCase()} / {item.technique.codecAudio.toUpperCase()}</span>
                    <span>48 kHz</span>
                    <span>{formatDuration(item.technique.dureeMs)}</span>
                    <span>{humanBytes(item.technique.tailleOctets)}</span>
                  </div>
                  <code title={item.technique.checksum}>SHA-256 {item.technique.checksum.slice(0, 16)}…</code>
                </div>
              )}

              {item.diagnostic && item.statut !== 'termine' && <p className="final-export-diagnostic">{item.diagnostic}</p>}

              <div className="final-export-actions">
                {item.actif && <button className="btn danger" onClick={() => void cancelExport(item)}><Ban size={13} /> Annuler</button>}
                {item.peutRelancer && <button className="btn" onClick={() => void retryExport(item)}><RotateCcw size={13} /> Relancer</button>}
                {item.technique && <button className="btn" onClick={() => void openFile(item)}><Play size={13} /> Lire</button>}
                {item.technique && <button className="btn" onClick={() => void showInFolder(item)}><FolderOpen size={13} /> Dossier</button>}
                <button className="btn ghost" onClick={() => void showDiagnostic(item)}><FileText size={13} /> Diagnostic</button>
              </div>

              {diagnostic?.exportId === item.id && (
                <pre className="final-export-log" aria-label="Diagnostic export final">{diagnostic.content}</pre>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
