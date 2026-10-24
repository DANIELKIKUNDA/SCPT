import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Import, Loader2, Mic2, Square } from 'lucide-react'
import type { NarrationTrackDto, ProjectDto, SceneDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { NarrationWaveform } from './NarrationWaveform'

interface NarrationPanelProps {
  project: ProjectDto
  scenes: SceneDto[]
  onTrackChange?: (track: NarrationTrackDto) => void
}

function narrationFromScenes(scenes: SceneDto[]): string {
  return [...scenes]
    .sort((a, b) => a.ordre - b.ordre)
    .map((scene) => scene.narrationTexte?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')
}

function formatDuration(durationMs: number): string {
  const seconds = durationMs / 1000
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)} min ${(seconds % 60).toFixed(0)} s`
}

export function NarrationPanel({ project, scenes, onTrackChange }: NarrationPanelProps): JSX.Element {
  const suggestedText = useMemo(() => narrationFromScenes(scenes), [scenes])
  const [track, setTrack] = useState<NarrationTrackDto | null>(null)
  const [text, setText] = useState(suggestedText)
  const [textTouched, setTextTouched] = useState(false)
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!textTouched) setText(suggestedText)
  }, [suggestedText, textTouched])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!window.electronAPI) return
      try {
        const loaded = unwrapIpc(await window.electronAPI.narrationGet({
          projectId: project.id,
          langue: project.langueSource
        }))
        if (cancelled) return
        setTrack(loaded)
        onTrackChange?.(loaded)
        setSelectedTakeId(loaded.priseFinaleId ?? loaded.prises.at(-1)?.id ?? null)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Narration indisponible')
      }
    })()
    return () => { cancelled = true }
  }, [project.id, project.langueSource, onTrackChange])

  async function generate(): Promise<void> {
    if (!window.electronAPI || !text.trim()) {
      setError('Ajoutez un texte de narration avant de générer la voix.')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.narrationGenerate({
        projectId: project.id,
        langue: project.langueSource,
        texte: text,
        voixId: 'fr_FR-siwis-medium'
      }))
      setTrack(updated)
      onTrackChange?.(updated)
      setSelectedTakeId(updated.prises.at(-1)?.id ?? null)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Génération impossible')
    } finally {
      setWorking(false)
    }
  }

  async function importAudio(): Promise<void> {
    if (!window.electronAPI) return
    setWorking(true)
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.narrationImport({
        projectId: project.id,
        langue: project.langueSource,
        texte: text
      }))
      if ('canceled' in updated && updated.canceled) return
      setTrack(updated)
      onTrackChange?.(updated)
      setSelectedTakeId(updated.prises.at(-1)?.id ?? null)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import audio impossible')
    } finally {
      setWorking(false)
    }
  }

  async function cancelGeneration(): Promise<void> {
    if (!window.electronAPI) return
    try {
      unwrapIpc(await window.electronAPI.narrationCancel(project.id))
    } finally {
      setWorking(false)
    }
  }

  async function selectFinal(takeId: string): Promise<void> {
    if (!window.electronAPI) return
    setError(null)
    try {
      const updated = unwrapIpc(await window.electronAPI.narrationSelectFinal({ projectId: project.id, takeId }))
      setTrack(updated)
      onTrackChange?.(updated)
      setSelectedTakeId(takeId)
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Sélection impossible')
    }
  }

  return (
    <section className="narration-panel studio-tool-panel" aria-label="Narration locale">
      <div className="tool-stage-banner">
        <div><span className="tool-stage-kicker">01 · VOIX & RYTHME</span><strong>Donnez une voix au projet</strong><small>Préparez le texte, comparez les prises et figez uniquement la meilleure version.</small></div>
        <div className="tool-stage-metrics"><span><b>{scenes.length}</b> scènes</span><span><b>{track?.prises.length ?? 0}</b> prises</span><span className={track?.priseFinaleId ? 'is-ready' : ''}><b>{track?.priseFinaleId ? '✓' : '—'}</b> voix finale</span></div>
      </div>
      <div className="narration-authoring">
        <div className="narration-title-row">
          <div>
            <strong>Narration locale</strong>
            <span>{track?.statut ?? 'brouillon'} · {track?.prises.length ?? 0} prise{(track?.prises.length ?? 0) > 1 ? 's' : ''}</span>
          </div>
          <div className="narration-actions">
            {working ? (
              <button className="btn btn-sm btn-warn" onClick={() => void cancelGeneration()}><Square size={13} /> Annuler</button>
            ) : (
              <>
                <button className="btn btn-sm" onClick={() => void importAudio()}><Import size={13} /> Importer WAV/MP3</button>
                <button className="btn btn-sm btn-primary" onClick={() => void generate()} disabled={!text.trim()}><Mic2 size={13} /> Générer avec Piper</button>
              </>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setTextTouched(true) }}
          placeholder="Le texte de narration des scènes apparaîtra ici."
          aria-label="Texte de narration"
        />
        <div className="narration-hint">
          <span>Voix : Français · SIWIS Medium</span>
          <button className="text-button" onClick={() => { setText(suggestedText); setTextTouched(false) }}>Reprendre le texte des scènes</button>
          {working && <span className="narration-working"><Loader2 size={13} className="spin" /> Génération en cours…</span>}
        </div>
        {error && <p className="narration-error" role="alert">{error}</p>}
      </div>

      <div className="narration-takes">
        <div className="narration-take-list" aria-label="Prises de narration">
          {track?.prises.length ? track.prises.map((take) => {
            const final = track.priseFinaleId === take.id
            return (
              <article
                key={take.id}
                className={`narration-take ${selectedTakeId === take.id ? 'selected' : ''}`}
                onClick={() => setSelectedTakeId(take.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedTakeId(take.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="take-main">
                  <strong>Prise {take.ordre}</strong>
                  <small>{take.source === 'piper' ? 'Piper' : 'Import'} · {formatDuration(take.dureeMs)}</small>
                </span>
                {final ? (
                  <span className="final-badge"><CheckCircle2 size={13} /> Finale</span>
                ) : (
                  <button
                    type="button"
                    className="take-select-final"
                    onClick={(event) => { event.stopPropagation(); void selectFinal(take.id) }}
                  >Retenir</button>
                )}
              </article>
            )
          }) : <p className="narration-empty">Aucune prise. Générez une voix ou importez un fichier audio.</p>}
        </div>
        <NarrationWaveform projectId={project.id} takeId={selectedTakeId} />
      </div>
    </section>
  )
}
