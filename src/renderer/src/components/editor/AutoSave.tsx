import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editor-store'

/**
 * AutoSave: debounces Zustand scene changes and persists them via IPC to SQLite.
 * SQLite remains the source of truth; Zustand is only transient UI state.
 */
export function AutoSave() {
  const isDirty = useEditorStore((s) => s.isDirty)
  const scenes = useEditorStore((s) => s.scenes)
  const projectId = useEditorStore((s) => s.projectId)
  const setDirty = useEditorStore((s) => s.setDirty)
  const setError = useEditorStore((s) => s.setError)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isDirty || !projectId) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      try {
        // Reorder: persist the entire scene list order
        const api = window.electronAPI
        if (!api) return

        await api.scenesReorder?.({ projetId: projectId, orderedIds: scenes.map((s) => s.id) })

        // Update each scene's properties
        for (const scene of scenes) {
          await api.scenesUpdate?.({
            sceneId: scene.id,
            projetId: projectId,
            titre: scene.titre,
            narrationTexte: scene.narrationTexte,
            texteAffiche: scene.texteAffiche,
            dureeMs: scene.dureeMs
          })
        }
        setDirty(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AutoSave failed')
      }
    }, 1500) // 1.5s debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty, scenes, projectId, setDirty, setError])

  return null
}