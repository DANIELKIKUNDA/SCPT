import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  History,
  RefreshCw,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import type {
  ProjectDto,
  ReliabilityBackupDto,
  ReliabilityOverviewDto,
  ReliabilityTaskDto
} from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'

interface ReliabilityPanelProps {
  project: ProjectDto
  onRestored: () => Promise<void>
}

const BACKUP_LABELS: Record<ReliabilityBackupDto['kind'], string> = {
  automatic: 'Automatique',
  manual: 'Manuelle',
  close: 'Fermeture propre',
  migration: 'Avant migration',
  pre_restore: 'Avant restauration'
}

function humanBytes(value: number): string {
  if (value < 1024) return `${value} o`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} Mo`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} Go`
}

function taskLabel(task: ReliabilityTaskDto): string {
  return task.kind === 'render' ? 'Rendu Remotion' : 'Export final FFmpeg'
}

export function ReliabilityPanel({ project, onRestored }: ReliabilityPanelProps): JSX.Element {
  const [overview, setOverview] = useState<ReliabilityOverviewDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return
    setLoading(true)
    try {
      setOverview(unwrapIpc(await window.electronAPI.reliabilityOverview(project.id)))
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'État de fiabilité indisponible')
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => { void load() }, [load])

  const activeTasks = useMemo(() => overview?.tasks.filter((task) => task.active) ?? [], [overview])

  async function runAudit(): Promise<void> {
    if (!window.electronAPI) return
    setBusyAction('audit')
    setMessage(null)
    try {
      setOverview(unwrapIpc(await window.electronAPI.reliabilityRunAudit(project.id)))
      setMessage('Audit terminé et historisé.')
      setError(null)
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : 'Audit impossible')
    } finally {
      setBusyAction(null)
    }
  }

  async function createBackup(): Promise<void> {
    if (!window.electronAPI) return
    setBusyAction('backup')
    setMessage(null)
    try {
      const backup = unwrapIpc(await window.electronAPI.reliabilityCreateBackup(project.id))
      setMessage(`Point de récupération créé : ${BACKUP_LABELS[backup.kind]}.`)
      await load()
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : 'Sauvegarde impossible')
    } finally {
      setBusyAction(null)
    }
  }

  async function cleanTemporary(): Promise<void> {
    if (!window.electronAPI) return
    setBusyAction('cleanup')
    setMessage(null)
    try {
      const result = unwrapIpc(await window.electronAPI.reliabilityCleanTemp(project.id))
      setMessage(`${result.removedEntries} élément(s) temporaire(s) supprimé(s), ${humanBytes(result.removedBytes)} libérés.`)
      await load()
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : 'Nettoyage impossible')
    } finally {
      setBusyAction(null)
    }
  }

  async function restoreBackup(backup: ReliabilityBackupDto): Promise<void> {
    if (!window.electronAPI) return
    const confirmed = window.confirm(
      `Restaurer le point ${new Date(backup.createdAt).toLocaleString()} ?\n\n` +
      'SCPT créera d’abord une sauvegarde de sécurité de l’état actuel. Le projet sera ensuite fermé et devra être rouvert.'
    )
    if (!confirmed) return
    setBusyAction(`restore:${backup.id}`)
    setMessage(null)
    try {
      const result = unwrapIpc(await window.electronAPI.reliabilityRestoreBackup({ projectId: project.id, backupId: backup.id }))
      setMessage(`Restauration terminée. Sauvegarde de sécurité : ${result.safetyBackupId}.`)
      await onRestored()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Restauration impossible. Rouvrez le projet avant de continuer.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="reliability-panel studio-tool-panel" aria-label="Fiabilité et récupération">
      <div className="tool-stage-banner">
        <div><span className="tool-stage-kicker">07 · SÉCURITÉ DU STUDIO</span><strong>Fiabilité & récupération</strong><small>Contrôlez l’intégrité du projet, créez des points de récupération et gardez les incidents traçables.</small></div>
        <div className="tool-stage-metrics"><span><b>{overview?.backups.length ?? 0}</b> sauvegardes</span><span><b>{activeTasks.length}</b> tâches actives</span><span className={overview?.audit.status === 'healthy' ? 'is-ready' : ''}><b>{overview?.audit.status === 'healthy' ? '✓' : '—'}</b> santé</span></div>
      </div>
      <div className="reliability-header">
        <div>
          <h3>Fiabilité & récupération</h3>
          <p>Audit local · snapshots · reprise après incident · historique des tâches</p>
        </div>
        <button className="icon-btn" title="Actualiser" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <div className="reliability-error" role="alert">{error}</div>}
      {message && <div className="reliability-message" role="status">{message}</div>}
      {overview?.crashRecovered && (
        <div className="reliability-warning" role="status">
          <AlertTriangle size={15} /> Une fermeture brutale précédente a été détectée. SCPT a nettoyé les temporaires abandonnés et relancé la réconciliation.
        </div>
      )}

      <div className="reliability-actions">
        <button className="btn" onClick={() => void runAudit()} disabled={busyAction !== null}>
          <ClipboardCheck size={14} /> {busyAction === 'audit' ? 'Audit…' : 'Lancer un audit'}
        </button>
        <button className="btn btn-primary" onClick={() => void createBackup()} disabled={busyAction !== null}>
          <DatabaseBackup size={14} /> {busyAction === 'backup' ? 'Sauvegarde…' : 'Créer un point de récupération'}
        </button>
        <button className="btn" onClick={() => void cleanTemporary()} disabled={busyAction !== null || activeTasks.length > 0} title={activeTasks.length > 0 ? 'Attendez la fin des tâches actives.' : 'Supprimer uniquement les temporaires recréables'}>
          <Trash2 size={14} /> {busyAction === 'cleanup' ? 'Nettoyage…' : 'Nettoyer les temporaires'}
        </button>
      </div>

      {overview && (
        <>
          <div className={`reliability-summary status-${overview.audit.status}`}>
            <ShieldCheck size={18} />
            <div>
              <strong>{overview.audit.status === 'healthy' ? 'Projet sain' : overview.audit.status === 'blocked' ? 'Anomalie bloquante' : 'Attention requise'}</strong>
              <span>Format {overview.versions.formatVersion} · schéma {overview.versions.databaseSchemaVersion} · SCPT {overview.versions.appVersion}</span>
            </div>
          </div>

          <div className="reliability-grid">
            <section className="reliability-card">
              <h4><ClipboardCheck size={15} /> Checklist</h4>
              <div className="reliability-checklist">
                {overview.audit.checklist.map((item) => (
                  <div key={item.id} className={`reliability-check status-${item.status}`}>
                    <CheckCircle2 size={14} />
                    <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="reliability-card">
              <h4><AlertTriangle size={15} /> Anomalies</h4>
              {overview.audit.anomalies.length === 0 ? (
                <p className="reliability-empty">Aucune anomalie détectée.</p>
              ) : (
                <div className="reliability-anomalies">
                  {overview.audit.anomalies.map((item, index) => (
                    <div key={`${item.code}-${index}`} className={`reliability-anomaly severity-${item.severity}`}>
                      <strong>{item.message}</strong>
                      <span>{item.detail ?? item.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="reliability-card reliability-backups">
            <h4><ArchiveRestore size={15} /> Points de récupération</h4>
            {overview.backups.length === 0 ? <p className="reliability-empty">Aucun snapshot disponible.</p> : (
              <div className="reliability-backup-list">
                {overview.backups.map((backup) => (
                  <div key={backup.id} className="reliability-backup-row">
                    <div>
                      <strong>{BACKUP_LABELS[backup.kind]}</strong>
                      <span>{new Date(backup.createdAt).toLocaleString()} · {backup.fileCount} fichiers · {humanBytes(backup.totalBytes)}</span>
                    </div>
                    <button className="btn ghost" onClick={() => void restoreBackup(backup)} disabled={busyAction !== null || activeTasks.length > 0}>
                      <ArchiveRestore size={13} /> {busyAction === `restore:${backup.id}` ? 'Restauration…' : 'Restaurer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="reliability-card reliability-tasks">
            <h4><History size={15} /> Tableau des tâches</h4>
            {overview.tasks.length === 0 ? <p className="reliability-empty">Aucune tâche historisée.</p> : (
              <div className="reliability-task-table">
                <div className="reliability-task-head"><span>Type</span><span>État</span><span>Tentative</span><span>Progression</span><span>Version</span></div>
                {overview.tasks.map((task) => (
                  <div key={`${task.kind}-${task.id}`} className="reliability-task-row">
                    <span>{taskLabel(task)}</span>
                    <span>{task.status}</span>
                    <span>{task.attempt}</span>
                    <span>{task.progress}%</span>
                    <span>{task.obsolete ? 'Historique' : 'Courante'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
