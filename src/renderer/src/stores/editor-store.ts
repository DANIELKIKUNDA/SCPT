/**
 * Editor Store — transient UI state only.
 * SQLite remains the authoritative source of truth.
 */
import { create } from 'zustand'
import type { SceneDto } from '../../../shared/types/electron-api'

export type SceneViewData = SceneDto

export interface EditorState {
  projectId: string | null
  scenes: SceneViewData[]
  selectedSceneId: string | null
  isDirty: boolean
  error: string | null
  undoStack: SceneViewData[][]

  setProjectId: (id: string | null) => void
  setScenes: (scenes: SceneViewData[]) => void
  selectScene: (id: string | null) => void
  addScene: (scene: SceneViewData) => void
  updateScene: (id: string, data: Partial<SceneViewData>) => void
  setSceneMedia: (id: string, mediaId: string | null) => void
  removeScene: (id: string) => void
  reorderScenes: (orderedIds: string[]) => void
  setDirty: (dirty: boolean) => void
  setError: (error: string | null) => void
  resetEditor: () => void
  undo: () => void
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
  setScenes: (scenes) => set({ scenes, isDirty: false }),
  selectScene: (id) => set({ selectedSceneId: id }),

  // Creation is already persisted by its IPC use case; it is not part of the
  // transient edit-history stack.
  addScene: (scene) =>
    set((state) => ({
      scenes: [...state.scenes, scene],
      selectedSceneId: scene.id,
      isDirty: state.isDirty
    })),

  updateScene: (id, data) =>
    set((state) => ({
      undoStack: [...state.undoStack, state.scenes.map((item) => ({ ...item }))],
      scenes: state.scenes.map((scene) => (scene.id === id ? { ...scene, ...data } : scene)),
      isDirty: true
    })),

  // Media association has its own persisted IPC operation. Updating the local mirror
  // must not create a fake autosave/undo entry that could diverge from SQLite.
  setSceneMedia: (id, mediaId) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => (scene.id === id ? { ...scene, mediaId } : scene))
    })),

  // Deletion is also persisted immediately; do not offer a transient undo that
  // would resurrect a scene only in memory.
  removeScene: (id) =>
    set((state) => ({
      scenes: state.scenes.filter((scene) => scene.id !== id),
      selectedSceneId: state.selectedSceneId === id ? null : state.selectedSceneId,
      isDirty: state.isDirty
    })),

  reorderScenes: (orderedIds) =>
    set((state) => {
      const reordered = orderedIds
        .map((id, index) => {
          const scene = state.scenes.find((candidate) => candidate.id === id)
          return scene ? { ...scene, ordre: index + 1 } : null
        })
        .filter((scene): scene is SceneViewData => scene !== null)

      return {
        undoStack: [...state.undoStack, state.scenes.map((item) => ({ ...item }))],
        scenes: reordered,
        isDirty: true
      }
    }),

  undo: () =>
    set((state) => {
      const previous = state.undoStack.at(-1)
      if (!previous) return {}
      // Media links are persisted independently from editable scene fields.
      // Never roll them back only in the transient store.
      const currentMediaById = new Map(state.scenes.map((scene) => [scene.id, scene.mediaId]))
      return {
        scenes: previous.map((scene) => ({
          ...scene,
          mediaId: currentMediaById.has(scene.id)
            ? (currentMediaById.get(scene.id) ?? null)
            : scene.mediaId
        })),
        undoStack: state.undoStack.slice(0, -1),
        isDirty: true
      }
    }),

  setDirty: (dirty) => set({ isDirty: dirty }),
  setError: (error) => set({ error }),
  resetEditor: () => set({
    projectId: null,
    scenes: [],
    selectedSceneId: null,
    isDirty: false,
    error: null,
    undoStack: []
  }),

  selectedScene: () => {
    const { scenes, selectedSceneId } = get()
    return scenes.find((scene) => scene.id === selectedSceneId) ?? null
  }
}))
