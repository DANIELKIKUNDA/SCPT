import { useEffect, useRef } from 'react'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'

/**
 * Debounced persistence of transient editor state.
 * SQLite remains the source of truth.
 */
export function AutoSave(): null {
  const isDirty = useEditorStore((state) => state.isDirty)
  const scenes = useEditorStore((state) => state.scenes)
  const projectId = useEditorStore((state) => state.projectId)
  const setDirty = useEditorStore((state) => state.setDirty)
  const setError = useEditorStore((state) => state.setError)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isDirty || !projectId) return
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      try {
        const api = window.electronAPI
        if (!api) throw new Error('Preload API unavailable')

        unwrapIpc(await api.scenesReorder({
          projetId: projectId,
          orderedIds: scenes.map((scene) => scene.id)
        }))

        for (const scene of scenes) {
          unwrapIpc(await api.scenesUpdate({
            sceneId: scene.id,
            projetId: projectId,
            titre: scene.titre,
            narrationTexte: scene.narrationTexte,
            texteAffiche: scene.texteAffiche,
            dureeMs: scene.dureeMs,
            composition: scene.composition,
            transition: scene.transition
          }))
        }

        setError(null)
        setDirty(false)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'AutoSave failed')
      }
    }, 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty, scenes, projectId, setDirty, setError])

  return null
}
