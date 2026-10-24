import { useEffect, useMemo, useState } from 'react'
import { Captions, CheckCircle2, Download, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import type {
  ProjectDto,
  SceneDto,
  SubtitlePositionDto,
  SubtitleSegmentDto,
  SubtitleTrackDto
} from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'

interface SubtitlePanelProps {
  project: ProjectDto
  scenes: SceneDto[]
  track: SubtitleTrackDto | null
  showInPreview: boolean
  onShowInPreviewChange: (value: boolean) => void
  onTrackChange: (track: SubtitleTrackDto) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}:${rest.toFixed(1).padStart(4, '0')}` : `${rest.toFixed(1)} s`
}

function statusLabel(status: SubtitleTrackDto['statut']): string {
  const labels: Record<SubtitleTrackDto['statut'], string> = {
    brouillon: 'Brouillon',
    a_resynchroniser: 'À resynchroniser',
    validee: 'Validée',
    obsolete: 'Obsolète'
  }
  return labels[status]
}

function SegmentEditor({
  projectId,
  segment,
  onChange
}: {
  projectId: string
  segment: SubtitleSegmentDto
  onChange: (track: SubtitleTrackDto) => void
}): JSX.Element {
  const [texte, setTexte] = useState(segment.texte)
  const [debut, setDebut] = useState((segment.debutMs / 1000).toFixed(2))
  const [fin, setFin] = useState((segment.finMs / 1000).toFixed(2))
  const [position, setPosition] = useState<SubtitlePositionDto>(segment.position)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTexte(segment.texte)
    setDebut((segment.debutMs / 1000).toFixed(2))
    setFin((segment.finMs / 1000).toFixed(2))
    setPosition(segment.position)
  }, [segment])

  async function save(): Promise<void> {
    if (!window.electronAPI) return
    const debutMs = Math.round(Number(debut) * 1000)
    const finMs = Math.round(Number(fin) * 1000)
    if (!Number.isFinite(debutMs) || !Number.isFinite(finMs)) {
      setError('Début et fin doivent être des nombres valides.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.subtitlesUpdateSegment({
        projectId,
        segmentId: segment.id,
        debutMs,
        finMs,
        texte,
        position
      }))
      onChange(updated)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Modification impossible')
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!window.electronAPI) return
    setBusy(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.subtitlesDeleteSegment({
        projectId,
        segmentId: segment.id
      }))
      onChange(updated)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="subtitle-segment-editor">
      <div className="subtitle-segment-head">
        <strong>#{segment.ordre}</strong>
        <span>{formatTime(segment.debutMs)} → {formatTime(segment.finMs)}</span>
      </div>
      <textarea
        value={texte}
        onChange={(event) => setTexte(event.target.value)}
        rows={2}
        maxLength={85}
        aria-label={`Texte du sous-titre ${segment.ordre}`}
      />
      <div className="subtitle-segment-controls">
        <label>Début <input value={debut} onChange={(event) => setDebut(event.target.value)} inputMode="decimal" /></label>
        <label>Fin <input value={fin} onChange={(event) => setFin(event.target.value)} inputMode="decimal" /></label>
        <select value={position} onChange={(event) => setPosition(event.target.value as SubtitlePositionDto)} aria-label="Position du sous-titre">
          <option value="bas">Bas</option>
          <option value="centre">Centre</option>
          <option value="haut">Haut</option>
        </select>
        <button className="icon-btn" onClick={() => void save()} disabled={busy} title="Enregistrer le segment"><Save size={13} /></button>
        <button className="icon-btn danger" onClick={() => void remove()} disabled={busy} title="Supprimer le segment"><Trash2 size={13} /></button>
      </div>
      {error && <p className="subtitle-inline-error" role="alert">{error}</p>}
    </article>
  )
}

export function SubtitlePanel({
  project,
  scenes,
  track,
  showInPreview,
  onShowInPreviewChange,
  onTrackChange
}: SubtitlePanelProps): JSX.Element {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportInfo, setExportInfo] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [newStart, setNewStart] = useState('0')
  const [newEnd, setNewEnd] = useState('2.5')

  const timelineDurationMs = useMemo(() => {
    const sceneDuration = scenes.reduce((sum, scene) => sum + scene.dureeMs, 0)
    const subtitleDuration = track?.segments.at(-1)?.finMs ?? 0
    return Math.max(1, sceneDuration, subtitleDuration)
  }, [scenes, track])

  const lastSegmentEndMs = track?.segments.at(-1)?.finMs ?? 0

  useEffect(() => {
    if (lastSegmentEndMs <= 0) return
    setNewStart((lastSegmentEndMs / 1000).toFixed(2))
    setNewEnd(((lastSegmentEndMs + 2500) / 1000).toFixed(2))
  }, [lastSegmentEndMs])

  async function synchronize(): Promise<void> {
    if (!window.electronAPI) return
    setWorking(true)
    setError(null)
    setExportInfo(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.subtitlesSynchronize({
        projectId: project.id,
        langue: project.langueSource
      }))
      onTrackChange(updated)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Synchronisation impossible')
    } finally {
      setWorking(false)
    }
  }

  async function validate(): Promise<void> {
    if (!window.electronAPI) return
    setWorking(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.subtitlesValidate(project.id))
      onTrackChange(updated)
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Validation impossible')
    } finally {
      setWorking(false)
    }
  }

  async function exportTrack(format: 'srt' | 'vtt'): Promise<void> {
    if (!window.electronAPI) return
    setWorking(true)
    setError(null)
    setExportInfo(null)
    try {
      const result = unwrapIpc(await window.electronAPI.subtitlesExport({ projectId: project.id, format }))
      if (!result.canceled) setExportInfo(`${format.toUpperCase()} exporté : ${result.fileName ?? 'fichier créé'}`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Export impossible')
    } finally {
      setWorking(false)
    }
  }

  async function addSegment(): Promise<void> {
    if (!window.electronAPI || !newText.trim()) return
    const debutMs = Math.round(Number(newStart) * 1000)
    const finMs = Math.round(Number(newEnd) * 1000)
    setWorking(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.subtitlesAddSegment({
        projectId: project.id,
        debutMs,
        finMs,
        texte: newText,
        position: 'bas'
      }))
      onTrackChange(updated)
      setNewText('')
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Ajout impossible')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="subtitle-panel studio-tool-panel" aria-label="Sous-titres">
      <div className="tool-stage-banner">
        <div><span className="tool-stage-kicker">02 · LISIBILITÉ</span><strong>Sous-titres éditoriaux</strong><small>Synchronisez, relisez et positionnez les sous-titres sans masquer l’information essentielle.</small></div>
        <div className="tool-stage-metrics"><span><b>{track?.segments.length ?? 0}</b> segments</span><span><b>{track ? statusLabel(track.statut) : 'Non créé'}</b> statut</span><span className={showInPreview ? 'is-ready' : ''}><b>{showInPreview ? '✓' : '—'}</b> aperçu</span></div>
      </div>
      <div className="subtitle-toolbar">
        <div className="subtitle-heading">
          <Captions size={17} />
          <div>
            <strong>Sous-titres</strong>
            <span>{track ? `${statusLabel(track.statut)} · ${track.segments.length} segment${track.segments.length > 1 ? 's' : ''} · v narration ${track.versionNarration}` : 'Chargement…'}</span>
          </div>
        </div>
        <div className="subtitle-actions">
          <label className="subtitle-preview-toggle">
            <input type="checkbox" checked={showInPreview} onChange={(event) => onShowInPreviewChange(event.target.checked)} />
            Incruster dans l’aperçu
          </label>
          <button className="btn btn-sm" onClick={() => void synchronize()} disabled={working}><RefreshCw size={13} /> Synchroniser</button>
          <button className="btn btn-sm btn-primary" onClick={() => void validate()} disabled={working || !track?.segments.length}><CheckCircle2 size={13} /> Valider</button>
          <button className="btn btn-sm" onClick={() => void exportTrack('srt')} disabled={working || track?.statut !== 'validee'}><Download size={13} /> SRT</button>
          <button className="btn btn-sm" onClick={() => void exportTrack('vtt')} disabled={working || track?.statut !== 'validee'}><Download size={13} /> VTT</button>
        </div>
      </div>

      {track?.statut === 'a_resynchroniser' && (
        <div className="subtitle-resync-warning">La narration a changé. Resynchronisez ou ajustez les timings avant validation.</div>
      )}
      {error && <p className="subtitle-error" role="alert">{error}</p>}
      {exportInfo && <p className="subtitle-success">{exportInfo}</p>}

      <div className="subtitle-timeline" aria-label="Timeline des sous-titres">
        <div className="subtitle-timeline-ruler"><span>0:00</span><span>{formatTime(timelineDurationMs / 2)}</span><span>{formatTime(timelineDurationMs)}</span></div>
        <div className="subtitle-timeline-track">
          {track?.segments.map((segment) => {
            const left = Math.max(0, Math.min(100, (segment.debutMs / timelineDurationMs) * 100))
            const width = Math.max(0.6, Math.min(100 - left, ((segment.finMs - segment.debutMs) / timelineDurationMs) * 100))
            return (
              <div
                key={segment.id}
                className="subtitle-timeline-segment"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${segment.ordre}. ${segment.texte.replace(/\n/g, ' ')}`}
              >{segment.ordre}</div>
            )
          })}
        </div>
      </div>

      <div className="subtitle-body">
        <div className="subtitle-segment-list">
          {track?.segments.length ? track.segments.map((segment) => (
            <SegmentEditor key={segment.id} projectId={project.id} segment={segment} onChange={onTrackChange} />
          )) : <p className="subtitle-empty">Aucun sous-titre. Sélectionnez une narration finale puis cliquez sur « Synchroniser ».</p>}
        </div>

        <aside className="subtitle-add-card">
          <strong><Plus size={14} /> Nouveau segment</strong>
          <textarea value={newText} onChange={(event) => setNewText(event.target.value)} rows={3} maxLength={85} placeholder="Texte du sous-titre" />
          <div className="subtitle-add-times">
            <label>Début (s)<input value={newStart} onChange={(event) => setNewStart(event.target.value)} /></label>
            <label>Fin (s)<input value={newEnd} onChange={(event) => setNewEnd(event.target.value)} /></label>
          </div>
          <button className="btn btn-sm" onClick={() => void addSegment()} disabled={working || !newText.trim()}><Plus size={13} /> Ajouter</button>
          <p>Maximum deux lignes. Les chevauchements et intervalles invalides sont refusés.</p>
        </aside>
      </div>
    </section>
  )
}
