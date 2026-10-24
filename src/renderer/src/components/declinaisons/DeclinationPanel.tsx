import { CheckCircle2, Layers3, RefreshCcw, RotateCw, ShieldCheck, Smartphone, Square, MonitorPlay } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DeclinaisonDto,
  DeclinaisonFormatDto,
  ProjectDto,
  SceneDto,
  SceneLayoutDto
} from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'

interface DeclinationPanelProps {
  project: ProjectDto
  scenes: SceneDto[]
  declinaisons: DeclinaisonDto[]
  selectedId: string | null
  onSelect: (declinaison: DeclinaisonDto | null) => void
  onRefresh: () => Promise<void>
  onChanged: (declinaison: DeclinaisonDto) => void
  sourceDirty: boolean
}

const FORMATS: Array<{
  format: DeclinaisonFormatDto
  label: string
  resolution: string
  description: string
  icon: typeof MonitorPlay
}> = [
  {
    format: 'HORIZONTAL_16_9',
    label: '16:9',
    resolution: '1920×1080',
    description: 'Référence principale · composition horizontale',
    icon: MonitorPlay
  },
  {
    format: 'VERTICAL_9_16',
    label: '9:16',
    resolution: '1080×1920',
    description: 'Recomposition réelle · lecture mobile',
    icon: Smartphone
  },
  {
    format: 'CARRE_1_1',
    label: '1:1',
    resolution: '1080×1080',
    description: 'Composition équilibrée · lecture mobile',
    icon: Square
  }
]

const STATUS_LABELS: Record<DeclinaisonDto['statut'], string> = {
  brouillon: 'Brouillon',
  adaptation_en_cours: 'Adaptation en cours',
  en_revision: 'En révision',
  valide: 'Validée',
  obsolete: 'Obsolète',
  pret_pour_rendu: 'Prête pour rendu'
}

function latestForFormat(items: DeclinaisonDto[], format: DeclinaisonFormatDto): DeclinaisonDto | null {
  const candidates = items.filter((item) => item.format === format)
  return candidates.find((item) => !item.obsolete) ?? candidates.at(-1) ?? null
}

export function DeclinationPanel({
  project,
  scenes,
  declinaisons,
  selectedId,
  onSelect,
  onRefresh,
  onChanged,
  sourceDirty
}: DeclinationPanelProps): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [layoutOverride, setLayoutOverride] = useState<'auto' | SceneLayoutDto>('auto')
  const [backgroundOverride, setBackgroundOverride] = useState('')
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId)
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null
  const selected = declinaisons.find((item) => item.id === selectedId && !item.obsolete) ?? null

  const currentByFormat = useMemo(
    () => new Map(FORMATS.map((spec) => [spec.format, latestForFormat(declinaisons, spec.format)])),
    [declinaisons]
  )

  const selectedOverride = selected && selectedScene
    ? selected.overrides.find((override) => override.sceneId === selectedScene.id) ?? null
    : null

  useEffect(() => {
    setLayoutOverride(selectedOverride?.layout ?? 'auto')
    setBackgroundOverride(selectedOverride?.backgroundColor ?? '')
  }, [selectedId, selectedSceneId, selectedOverride?.layout, selectedOverride?.backgroundColor])

  async function create(format: DeclinaisonFormatDto): Promise<void> {
    if (sourceDirty) { setMessage('Sauvegardez les scènes avant de créer une déclinaison.'); return }
    const api = window.electronAPI
    if (!api) return
    setBusy(`create:${format}`)
    setMessage(null)
    try {
      const created = unwrapIpc(await api.declinaisonsCreate({
        projectId: project.id,
        format,
        langue: project.langueSource,
        profilExport: 'MVP_PREMIUM'
      }))
      onChanged(created)
      onSelect(created)
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Création impossible')
    } finally {
      setBusy(null)
    }
  }

  async function validate(item: DeclinaisonDto): Promise<void> {
    if (sourceDirty) { setMessage('Sauvegardez les scènes avant de valider la déclinaison.'); return }
    const api = window.electronAPI
    if (!api) return
    setBusy(`validate:${item.id}`)
    setMessage(null)
    try {
      const updated = unwrapIpc(await api.declinaisonsValidate({ projectId: project.id, declinaisonId: item.id }))
      onChanged(updated)
      onSelect(updated)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Validation impossible')
    } finally {
      setBusy(null)
    }
  }

  async function markReady(item: DeclinaisonDto): Promise<void> {
    if (sourceDirty) { setMessage('Sauvegardez les scènes avant de figer la déclinaison.'); return }
    const api = window.electronAPI
    if (!api) return
    setBusy(`ready:${item.id}`)
    setMessage(null)
    try {
      const updated = unwrapIpc(await api.declinaisonsMarkReady({ projectId: project.id, declinaisonId: item.id }))
      onChanged(updated)
      onSelect(updated)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Préparation impossible')
    } finally {
      setBusy(null)
    }
  }

  async function applyOverride(): Promise<void> {
    const api = window.electronAPI
    if (!api || !selected || !selectedScene) return
    if (layoutOverride === 'auto' && !backgroundOverride.trim()) {
      setMessage('Choisissez une disposition ou une couleur de fond à surcharger.')
      return
    }
    setBusy(`override:${selectedScene.id}`)
    setMessage(null)
    try {
      const updated = unwrapIpc(await api.declinaisonsSetOverride({
        projectId: project.id,
        declinaisonId: selected.id,
        sceneId: selectedScene.id,
        layout: layoutOverride === 'auto' ? undefined : layoutOverride,
        backgroundColor: backgroundOverride.trim() || undefined
      }))
      onChanged(updated)
      onSelect(updated)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Surcharge impossible')
    } finally {
      setBusy(null)
    }
  }

  async function removeOverride(): Promise<void> {
    const api = window.electronAPI
    if (!api || !selected || !selectedScene || !selectedOverride) return
    setBusy(`remove:${selectedScene.id}`)
    setMessage(null)
    try {
      const updated = unwrapIpc(await api.declinaisonsRemoveOverride({
        projectId: project.id,
        declinaisonId: selected.id,
        sceneId: selectedScene.id
      }))
      onChanged(updated)
      onSelect(updated)
      setLayoutOverride('auto')
      setBackgroundOverride('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression impossible')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="declination-panel studio-tool-panel" aria-label="Déclinaisons multi-format">
      <div className="tool-stage-banner">
        <div><span className="tool-stage-kicker">04 · ADAPTATION</span><strong>Un projet, plusieurs compositions</strong><small>Chaque format possède sa propre mise en page. Les adaptations restent liées à la source et traçables.</small></div>
        <div className="tool-stage-metrics"><span><b>{declinaisons.filter((item) => !item.obsolete).length}</b> actives</span><span><b>{declinaisons.filter((item) => item.pretPourRendu && !item.obsolete).length}</b> prêtes</span><span className={!sourceDirty ? 'is-ready' : ''}><b>{sourceDirty ? '!' : '✓'}</b> source</span></div>
      </div>
      <div className="declination-heading">
        <div>
          <h3><Layers3 size={17} /> Déclinaisons visuelles</h3>
          <p>Un même projet, trois compositions adaptées. Le 9:16 n’utilise jamais un simple recadrage.</p>
        </div>
        <button className="icon-btn labeled" onClick={() => void onRefresh()} disabled={Boolean(busy)}>
          <RefreshCcw size={14} /> Actualiser
        </button>
      </div>

      {sourceDirty && <p className="declination-dirty-warning">Sauvegarde source en attente — création et validation temporairement verrouillées.</p>}

      <div className="declination-format-grid">
        {FORMATS.map((spec) => {
          const item = currentByFormat.get(spec.format) ?? null
          const Icon = spec.icon
          const active = item && !item.obsolete && item.id === selectedId
          return (
            <article key={spec.format} className={`declination-card ${active ? 'active' : ''} ${item?.obsolete ? 'obsolete' : ''}`}>
              <div className="declination-card-title">
                <Icon size={20} />
                <div><strong>{spec.label}</strong><span>{spec.resolution}</span></div>
              </div>
              <p>{spec.description}</p>
              {item ? (
                <>
                  <div className="declination-status-row">
                    <span className={`declination-status status-${item.statut}`}>{STATUS_LABELS[item.statut]}</span>
                    <span>v{item.version} · source v{item.versionProjetSource}</span>
                  </div>
                  {item.obsolete ? (
                    <button className="btn btn-sm" onClick={() => void create(spec.format)} disabled={Boolean(busy) || sourceDirty}>
                      <RotateCw size={13} /> Nouvelle version
                    </button>
                  ) : (
                    <div className="declination-card-actions">
                      <button className="btn btn-sm" onClick={() => onSelect(item)}>Aperçu</button>
                      {item.statut !== 'valide' && item.statut !== 'pret_pour_rendu' && (
                        <button className="btn btn-sm" onClick={() => void validate(item)} disabled={Boolean(busy) || sourceDirty}>Valider</button>
                      )}
                      {item.statut === 'valide' && (
                        <button className="btn btn-sm" onClick={() => void markReady(item)} disabled={Boolean(busy) || sourceDirty}>
                          <ShieldCheck size={13} /> Prête
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <button className="btn btn-sm" onClick={() => void create(spec.format)} disabled={Boolean(busy) || sourceDirty}>
                  Créer {spec.label}
                </button>
              )}
            </article>
          )
        })}
      </div>

      {selected && (
        <div className="declination-detail">
          <div className="declination-detail-head">
            <div>
              <strong>Aperçu {FORMATS.find((spec) => spec.format === selected.format)?.label}</strong>
              <span>{selected.resolution.width}×{selected.resolution.height} · {selected.profilExport.replace('_', ' ')}</span>
            </div>
            <span className="safe-zone-chip"><ShieldCheck size={13} /> Zones sûres actives</span>
          </div>

          <div className="declination-source-state">
            <CheckCircle2 size={14} /> Source v{selected.versionProjetSource} / courante v{selected.versionSourceCourante}
          </div>

          {selectedScene ? (
            <div className="declination-override-editor">
              <div>
                <strong>Surcharge de la scène {selectedScene.ordre}</strong>
                <span>La source reste intacte ; cette adaptation ne vaut que pour ce format.</span>
              </div>
              <select
                value={layoutOverride}
                onChange={(event) => setLayoutOverride(event.target.value as 'auto' | SceneLayoutDto)}
                disabled={selected.pretPourRendu}
              >
                <option value="auto">Disposition automatique</option>
                <option value="centered">Centrée</option>
                <option value="top">En haut</option>
                <option value="split-left">Partagée gauche</option>
                <option value="split-right">Partagée droite</option>
              </select>
              <input
                value={backgroundOverride}
                onChange={(event) => setBackgroundOverride(event.target.value)}
                placeholder="Fond optionnel, ex. #0b1020"
                maxLength={64}
                disabled={selected.pretPourRendu}
              />
              <div className="declination-override-actions">
                <button className="btn btn-sm" onClick={() => void applyOverride()} disabled={Boolean(busy) || selected.pretPourRendu}>
                  Appliquer la surcharge
                </button>
                {selectedOverride && (
                  <button className="btn btn-sm" onClick={() => void removeOverride()} disabled={Boolean(busy) || selected.pretPourRendu}>
                    Restaurer l’auto
                  </button>
                )}
              </div>
              {selectedOverride && (
                <small>
                  Surcharge active : {selectedOverride.layout ?? 'layout auto'}{selectedOverride.backgroundColor ? ` · ${selectedOverride.backgroundColor}` : ''}
                </small>
              )}
            </div>
          ) : (
            <p className="empty-msg">Sélectionnez une scène pour régler une adaptation locale.</p>
          )}
        </div>
      )}

      {message && <p className="declination-message" role="alert">{message}</p>}
    </section>
  )
}
