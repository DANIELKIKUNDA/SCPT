import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { GripVertical, Plus } from 'lucide-react'
import type { SceneTypeDto } from '../../../../shared/types/electron-api'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'

const CREATE_TYPES: Array<{ value: SceneTypeDto; label: string }> = [
  { value: 'texte', label: 'Texte' },
  { value: 'formule', label: 'Formule' },
  { value: 'image', label: 'Image' },
  { value: 'code', label: 'Code' },
  { value: 'diagramme', label: 'Diagramme' }
]

interface SortableItemProps {
  id: string
  ordre: number
  type: string
  titre: string | null
  dureeMs: number
  selected: boolean
  onSelect: (id: string) => void
}

function SortableItem({ id, ordre, type, titre, dureeMs, selected, onSelect }: SortableItemProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
          : undefined,
        transition
      }}
      className={`scene-item ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(id)}
    >
      <span className="scene-grip" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <span className="scene-ord">{ordre}</span>
      <span className="scene-type-badge">{type.slice(0, 3).toUpperCase()}</span>
      <span className="scene-title">{titre ?? '(sans titre)'}</span>
      <span className="scene-dur">{(dureeMs / 1000).toFixed(dureeMs % 1000 === 0 ? 0 : 1)}s</span>
    </button>
  )
}

export function SceneList(): JSX.Element {
  const scenes = useEditorStore((state) => state.scenes)
  const selected = useEditorStore((state) => state.selectedSceneId)
  const projectId = useEditorStore((state) => state.projectId)
  const reorderScenes = useEditorStore((state) => state.reorderScenes)
  const selectScene = useEditorStore((state) => state.selectScene)
  const addScene = useEditorStore((state) => state.addScene)
  const setError = useEditorStore((state) => state.setError)
  const [newType, setNewType] = useState<SceneTypeDto>('texte')
  const [creating, setCreating] = useState(false)

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = scenes.findIndex((scene) => scene.id === active.id)
    const newIndex = scenes.findIndex((scene) => scene.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = [...scenes]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderScenes(reordered.map((scene) => scene.id))
  }

  async function handleCreate(): Promise<void> {
    const api = window.electronAPI
    if (!api || !projectId || creating) return
    setCreating(true)
    setError(null)
    try {
      const scene = unwrapIpc(await api.scenesCreate({ projetId: projectId, type: newType }))
      addScene(scene)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Création de scène impossible')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="scene-list-panel" aria-label="Liste des scènes">
      <div className="scene-list-header">
        <span>Scènes ({scenes.length})</span>
        <div className="scene-create-controls">
          <select value={newType} onChange={(event) => setNewType(event.target.value as SceneTypeDto)}>
            {CREATE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <button
            type="button"
            className="icon-btn"
            title="Nouvelle scène"
            aria-label="Nouvelle scène"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={scenes.map((scene) => scene.id)} strategy={verticalListSortingStrategy}>
          <div className="scene-list">
            {scenes.map((scene) => (
              <SortableItem
                key={scene.id}
                id={scene.id}
                ordre={scene.ordre}
                type={scene.type}
                titre={scene.titre}
                dureeMs={scene.dureeMs}
                selected={scene.id === selected}
                onSelect={selectScene}
              />
            ))}
            {scenes.length === 0 && (
              <p className="panel-empty">Créez une première scène pour commencer.</p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
