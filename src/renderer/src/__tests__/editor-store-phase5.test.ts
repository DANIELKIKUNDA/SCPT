import { beforeEach, describe, expect, it } from 'vitest'
import type { SceneDto } from '../../../shared/types/electron-api'
import { useEditorStore } from '../stores/editor-store'

function makeScene(id: string, overrides: Partial<SceneDto> = {}): SceneDto {
  return {
    id,
    projetId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    ordre: 1,
    type: 'texte',
    titre: 'Titre',
    narrationTexte: null,
    texteAffiche: 'Texte',
    dureeMs: 5000,
    composition: { backgroundColor: '#1e1e2e', layout: 'centered' },
    transition: { type: 'fade', durationMs: 300 },
    mediaId: null,
    ...overrides
  }
}

describe('Phase 5 editor transient state', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor()
  })

  it('mirrors a persisted media association without making the editor dirty', () => {
    const store = useEditorStore.getState()
    store.setScenes([makeScene('s1')])
    store.setSceneMedia('s1', 'm1')

    const after = useEditorStore.getState()
    expect(after.scenes[0].mediaId).toBe('m1')
    expect(after.isDirty).toBe(false)
    expect(after.undoStack).toHaveLength(0)
  })

  it('undoing editable fields never rolls back the independently persisted media link', () => {
    const store = useEditorStore.getState()
    store.setScenes([makeScene('s1')])
    store.updateScene('s1', { titre: 'Nouveau titre' })
    store.setSceneMedia('s1', 'm1')
    useEditorStore.getState().undo()

    const after = useEditorStore.getState()
    expect(after.scenes[0].titre).toBe('Titre')
    expect(after.scenes[0].mediaId).toBe('m1')
    expect(after.isDirty).toBe(true)
  })

  it('does not create transient undo entries for already-persisted create/delete operations', () => {
    const store = useEditorStore.getState()
    store.setScenes([makeScene('s1')])
    store.addScene(makeScene('s2', { ordre: 2 }))
    expect(useEditorStore.getState().undoStack).toHaveLength(0)

    useEditorStore.getState().removeScene('s2')
    expect(useEditorStore.getState().undoStack).toHaveLength(0)
  })
})
