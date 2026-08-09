import React from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'

function SortableItem({ id, ordre, type, titre, dureeMs, selected }: { id: string; ordre: number; type: string; titre: string | null; dureeMs: number; selected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`scene-item ${selected ? 'selected' : ''}`}
      onClick={() => useEditorStore.getState().selectScene(id)}
    >
      <span className="scene-grip" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <span className="scene-ord">{ordre}</span>
      <span className="scene-type-badge">{type.slice(0, 3)}</span>
      <span className="scene-title">{titre ?? '(sans titre)'}</span>
      <span className="scene-dur">{Math.round(dureeMs / 1000)}s</span>
    </div>
  )
}

export function SceneList() {
  const scenes = useEditorStore((s) => s.scenes)
  const selected = useEditorStore((s) => s.selectedSceneId)
  const reorderScenes = useEditorStore((s) => s.reorderScenes)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = scenes.findIndex((s) => s.id === active.id)
      const newIdx = scenes.findIndex((s) => s.id === over.id)
      const reordered = [...scenes]
      const [moved] = reordered.splice(oldIdx, 1)
      reordered.splice(newIdx, 0, moved)
      reorderScenes(reordered.map((s) => s.id))
    }
  }

  return (
    <div className="scene-list-panel">
      <div className="scene-list-header">
        <span>Scènes ({scenes.length})</span>
        <button
          className="icon-btn"
          title="Nouvelle scène"
          onClick={() => window.electronAPI?.scenesCreate?.()}
        >
          <Plus size={16} />
        </button>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="scene-list">
            {scenes.map((s) => (
              <SortableItem
                key={s.id}
                id={s.id}
                ordre={s.ordre}
                type={s.type}
                titre={s.titre}
                dureeMs={s.dureeMs}
                selected={s.id === selected}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}