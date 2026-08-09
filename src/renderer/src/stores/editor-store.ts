/**
 * Phase 3 Editor Store — Zustand for transient UI state only.
 * NOT a source of truth: SQLite is the authoritative persistence.
 */
import { create } from 'zustand'

export interface SceneViewData {
  id: string
  projetId: string
  ordre: number
  type: string
  titre: string | null
  narrationTexte: string | null
  texteAffiche: string | null
  dureeMs: number
}

export interface EditorState {
  /** Currently open project ID */
  projectId: string | null
  /** List of scenes in display order */
  scenes: SceneViewData[]
  /** Currently selected scene ID */
  selectedSceneId: string | null
  /** Dirty flag for unsaved changes */
  isDirty: boolean
  /** Error message if any */
  error: string | null
  /** Undo stack: snapshots of scenes before mutations */
  undoStack: SceneViewData[][]

  setProjectId: (id: string | null) => void
  setScenes: (scenes: SceneViewData[]) => void
  selectScene: (id: string | null) => void
  addScene: (scene: SceneViewData) => void
  updateScene: (id: string, data: Partial<SceneViewData>) => void
  removeScene: (id: string) => void
  reorderScenes: (orderedIds: string[]) => void
  setDirty: (dirty: boolean) => void
  setError: (error: string | null) => void
  /** Undo the last mutation (reorder, update, delete, etc.) */
  undo: () => void
  /** Get the currently selected scene object */
  selectedScene: () => SceneViewData | null
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  scenes: [],
  selectedSceneId: null,
  isDirty: false,
  error: null,
  undoStack: [],

  setProjectId: (id) => set({ projectId: id }),
  setScenes: (scenes) => set({ scenes }),

  selectScene: (id) => set({ selectedSceneId: id }),

  addScene: (scene) => set((s) => {
    s.undoStack.push([...s.scenes])
    return { scenes: [...s.scenes, scene], isDirty: false }
  }),

  updateScene: (id, data) =>
    set((s) => {
      s.undoStack.push([...s.scenes])
      return {
        scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...data } : sc)),
        isDirty: true
      }
    }),

  removeScene: (id) =>
    set((s) => {
      s.undoStack.push([...s.scenes])
      return {
        scenes: s.scenes.filter((sc) => sc.id !== id),
        selectedSceneId: s.selectedSceneId === id ? null : s.selectedSceneId,
        isDirty: false
      }
    }),

  reorderScenes: (orderedIds) =>
    set((s) => {
      s.undoStack.push([...s.scenes])
      const reordered = orderedIds
        .map((id) => s.scenes.find((sc) => sc.id === id))
        .filter(Boolean) as SceneViewData[]
      return { scenes: reordered, isDirty: true }
    }),

  undo: () =>
    set((s) => {
      const prev = s.undoStack.pop()
      if (!prev) return {}
      return { scenes: prev, isDirty: false }
    }),

  setDirty: (dirty) => set({ isDirty: dirty }),
  setError: (error) => set({ error }),

  selectedScene: () => {
    const { scenes, selectedSceneId } = get()
    return scenes.find((s) => s.id === selectedSceneId) ?? null
  }
}))