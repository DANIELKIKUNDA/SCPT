import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Clock3, FileText, Film, Play, RefreshCw, RotateCcw } from 'lucide-react'
import type { DeclinaisonDto, ProjectDto, RenderJobDto, RenderJobStatusDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'

interface RenderingPanelProps {
  project: ProjectDto
  declinaisons: DeclinaisonDto[]
}

const STATUS_LABELS: Record<RenderJobStatusDto, string> = {
  demande: 'Demandé',
  en_attente: 'En attente',
  en_preparation: 'Préparation',
  en_composition: 'Composition Remotion',
  en_encodage: 'Encodage intermédiaire',
  en_verification: 'Vérification',
  termine: 'Terminé',
  echoue: 'Échoué',
  annule: 'Annulé'
}

function formatLabel(format: DeclinaisonDto['format']): string {
  if (format === 'VERTICAL_9_16') return '9:16'
  if (format === 'CARRE_1_1') return '1:1'
  return '16:9'
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function RenderingPanel({ project, declinaisons }: RenderingPanelProps): JSX.Element {
  const [jobs, setJobs] = useState<RenderJobDto[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<{ jobId: string; content: string } | null>(null)

  const loadJobs = useCallback(async (silent = false): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    if (!silent) setLoading(true)
    try {
      setJobs(unwrapIpc(await api.renderList(project.id)))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tâches de rendu indisponibles')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const hasActiveJob = jobs.some((job) => job.actif)
  useEffect(() => {
    if (!hasActiveJob) return
    const timer = window.setInterval(() => { void loadJobs(true) }, 1000)
    return () => window.clearInterval(timer)
  }, [hasActiveJob, loadJobs])

  const readyDeclinaisons = useMemo(
    () => declinaisons.filter((item) => !item.obsolete && item.pretPourRendu),
    [declinaisons]
  )

  async function startRender(declinaison: DeclinaisonDto): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    setMessage(null)
    try {
      unwrapIpc(await api.renderStart({ projectId: project.id, declinaisonId: declinaison.id }))
      setMessage(`Rendu ${formatLabel(declinaison.format)} ajouté à la file.`)
      await loadJobs(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de lancer le rendu')
    }
  }

  async function cancelRender(job: RenderJobDto): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    setMessage(null)
    try {
      unwrapIpc(await api.renderCancel({ projectId: project.id, jobId: job.id }))
      setMessage('Annulation demandée.')
      await loadJobs(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Annulation impossible')
    }
  }

  async function retryRender(job: RenderJobDto): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    setMessage(null)
    try {
      unwrapIpc(await api.renderRetry({ projectId: project.id, jobId: job.id }))
      setMessage(`Nouvelle tentative ${job.tentative + 1} planifiée.`)
      await loadJobs(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Relance impossible')
    }
  }

  async function showDiagnostic(job: RenderJobDto): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    const fallback = job.diagnostic ?? 'Aucun diagnostic métier enregistré.'
    try {
      const result = unwrapIpc(await api.renderReadLog({ projectId: project.id, jobId: job.id }))
      setDiagnostic({ jobId: job.id, content: result.content.trim() || fallback })
    } catch {
      setDiagnostic({ jobId: job.id, content: fallback })
    }
  }

  return (
    <section className="rendering-panel" aria-label="Rendus Remotion">
      <div className="rendering-heading">
        <div>
          <h3><Film size={16} /> Rendu intermédiaire Remotion</h3>
          <p>Une seule tâche est rendue à la fois. Les sorties restent locales au projet.</p>
        </div>
        <button className="icon-btn labeled" onClick={() => void loadJobs()} disabled={loading}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div className="render-ready-grid">
        {readyDeclinaisons.length === 0 ? (
          <div className="render-empty">
            <Clock3 size={18} />
            <span>Validez une déclinaison puis marquez-la « prête pour rendu » dans Formats.</span>
          </div>
        ) : readyDeclinaisons.map((declinaison) => {
          const active = jobs.find((job) => job.declinaisonId === declinaison.id && job.actif)
          return (
            <article className="render-ready-card" key={declinaison.id}>
              <div>
                <strong>{formatLabel(declinaison.format)}</strong>
                <span>{declinaison.resolution.width}×{declinaison.resolution.height} · {declinaison.langue.toUpperCase()}</span>
              </div>
              <button
                className="btn primary"
                disabled={Boolean(active)}
                onClick={() => void startRender(declinaison)}
              >
                <Play size={14} /> {active ? 'Rendu en cours' : 'Lancer le rendu'}
              </button>
            </article>
          )
        })}
      </div>

      {message && <p className="render-message" role="status">{message}</p>}

      <div className="render-job-list">
        {jobs.length === 0 ? (
          <div className="render-empty"><Film size={18} /><span>Aucune tâche de rendu pour ce projet.</span></div>
        ) : jobs.map((job) => {
          const declinaison = declinaisons.find((item) => item.id === job.declinaisonId)
          return (
            <article className={`render-job status-${job.statut}`} key={job.id}>
              <div className="render-job-head">
                <div>
                  <strong>{declinaison ? formatLabel(declinaison.format) : 'Déclinaison'} · tentative {job.tentative}</strong>
                  <span>{STATUS_LABELS[job.statut]} · {shortTime(job.updatedAt)}</span>
                </div>
                <span className="render-job-percent">{job.progression}%</span>
              </div>

              <div className="render-progress" aria-label={`Progression ${job.progression}%`}>
                <div style={{ width: `${job.progression}%` }} />
              </div>

              {job.cheminFichier && (
                <p className="render-output"><CheckCircle2 size={13} /> {job.cheminFichier}</p>
              )}
              {job.diagnostic && job.statut !== 'termine' && (
                <p className="render-diagnostic">{job.diagnostic}</p>
              )}

              <div className="render-job-actions">
                {job.actif && (
                  <button className="btn danger" onClick={() => void cancelRender(job)}>
                    <Ban size={13} /> Annuler
                  </button>
                )}
                {job.peutRelancer && (
                  <button className="btn" onClick={() => void retryRender(job)}>
                    <RotateCcw size={13} /> Relancer
                  </button>
                )}
                <button className="btn ghost" onClick={() => void showDiagnostic(job)}>
                  <FileText size={13} /> Diagnostic
                </button>
              </div>

              {diagnostic?.jobId === job.id && (
                <pre className="render-log" aria-label="Diagnostic de rendu">{diagnostic.content}</pre>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
