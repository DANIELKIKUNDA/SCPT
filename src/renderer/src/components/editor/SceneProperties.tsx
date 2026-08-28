import { useCallback, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Trash2 } from 'lucide-react'
import type { SceneLayoutDto, SceneTransitionTypeDto } from '../../../../shared/types/electron-api'
import { configureMonaco } from '../../monaco/configure-monaco'
import { unwrapIpc } from '../../lib/ipc'
import { useEditorStore } from '../../stores/editor-store'

const sceneSchema = z.object({
  titre: z.string().max(300).optional(),
  narrationTexte: z.string().max(20000).optional(),
  texteAffiche: z.string().max(20000).optional(),
  dureeMs: z.number().min(100, 'Durée minimum 100ms').max(300000, 'Max 5 minutes'),
  backgroundColor: z.string().min(1),
  layout: z.enum(['centered', 'top', 'split-left', 'split-right']),
  transitionType: z.enum(['fade', 'slide-left', 'slide-right', 'none']),
  transitionDurationMs: z.number().int().min(0).max(5000)
})

type SceneFormData = z.infer<typeof sceneSchema>

export function SceneProperties(): JSX.Element {
  const selectedScene = useEditorStore((state) => state.selectedScene())
  const updateScene = useEditorStore((state) => state.updateScene)
  const removeScene = useEditorStore((state) => state.removeScene)
  const addScene = useEditorStore((state) => state.addScene)
  const projectId = useEditorStore((state) => state.projectId)
  const setError = useEditorStore((state) => state.setError)
  const [monacoReady, setMonacoReady] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<SceneFormData>({
    resolver: zodResolver(sceneSchema),
    defaultValues: {
      titre: '',
      narrationTexte: '',
      texteAffiche: '',
      dureeMs: 5000,
      backgroundColor: '#1e1e2e',
      layout: 'centered',
      transitionType: 'fade',
      transitionDurationMs: 300
    }
  })

  useEffect(() => {
    if (selectedScene?.type !== 'code') return

    let cancelled = false
    configureMonaco()
      .then(() => {
        if (!cancelled) setMonacoReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Impossible de charger Monaco')
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedScene?.type, setError])

  useEffect(() => {
    reset({
      titre: selectedScene?.titre ?? '',
      narrationTexte: selectedScene?.narrationTexte ?? '',
      texteAffiche: selectedScene?.texteAffiche ?? '',
      dureeMs: selectedScene?.dureeMs ?? 5000,
      backgroundColor: selectedScene?.composition.backgroundColor ?? '#1e1e2e',
      layout: selectedScene?.composition.layout ?? 'centered',
      transitionType: selectedScene?.transition.type ?? 'fade',
      transitionDurationMs: selectedScene?.transition.durationMs ?? 300
    })
  }, [selectedScene, reset])

  const onSubmit = useCallback((data: SceneFormData) => {
    if (!selectedScene || !projectId) return
    updateScene(selectedScene.id, {
      titre: data.titre || null,
      narrationTexte: data.narrationTexte || null,
      texteAffiche: selectedScene.type === 'code' ? selectedScene.texteAffiche : data.texteAffiche || null,
      dureeMs: data.dureeMs,
      composition: {
        backgroundColor: data.backgroundColor,
        layout: data.layout as SceneLayoutDto
      },
      transition: {
        type: data.transitionType as SceneTransitionTypeDto,
        durationMs: data.transitionDurationMs
      }
    })
  }, [projectId, selectedScene, updateScene])

  async function duplicateScene(): Promise<void> {
    if (!selectedScene || !projectId || !window.electronAPI) return
    setError(null)
    try {
      const duplicate = unwrapIpc(
        await window.electronAPI.scenesDuplicate({ sceneId: selectedScene.id, projetId: projectId })
      )
      addScene(duplicate)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Duplication impossible')
    }
  }

  async function deleteScene(): Promise<void> {
    if (!selectedScene || !projectId || !window.electronAPI) return
    if (!confirm('Supprimer cette scène ?')) return
    setError(null)
    try {
      unwrapIpc(await window.electronAPI.scenesDelete({ sceneId: selectedScene.id, projetId: projectId }))
      removeScene(selectedScene.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Suppression impossible')
    }
  }

  if (!selectedScene) {
    return <div className="scene-properties-empty">Sélectionnez une scène pour modifier ses propriétés.</div>
  }

  const visibleTextLabel = selectedScene.type === 'formule'
    ? 'Formule KaTeX'
    : selectedScene.type === 'diagramme'
      ? 'Données du diagramme'
      : 'Texte affiché'

  return (
    <section className="scene-properties-panel" aria-label="Propriétés de la scène">
      <div className="scene-props-header">
        <span>Propriétés · {selectedScene.type}</span>
        <div className="scene-props-actions">
          <button className="icon-btn" title="Dupliquer" onClick={() => void duplicateScene()}>
            <Copy size={14} />
          </button>
          <button className="icon-btn danger" title="Supprimer" onClick={() => void deleteScene()}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <form onChange={handleSubmit(onSubmit)} className="scene-form">
        <label>
          Titre
          <input {...register('titre')} placeholder="Titre de la scène" />
        </label>

        {selectedScene.type === 'code' ? (
          <label className="code-editor-field">
            Code source
            <div className="monaco-shell">
              {monacoReady ? (
                <Editor
                  height="250px"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={selectedScene.texteAffiche ?? ''}
                  onChange={(value) => updateScene(selectedScene.id, { texteAffiche: value ?? '' })}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbersMinChars: 3,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              ) : (
                <div className="monaco-loading">Chargement de l’éditeur…</div>
              )}
            </div>
          </label>
        ) : (
          <label>
            {visibleTextLabel}
            <textarea
              {...register('texteAffiche')}
              placeholder={selectedScene.type === 'diagramme'
                ? 'Exemple :\nJanvier: 12\nFévrier: 18\nMars: 25'
                : selectedScene.type === 'formule'
                  ? 'x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}'
                  : 'Texte visible à l’écran'}
              rows={selectedScene.type === 'diagramme' ? 6 : 4}
            />
            {selectedScene.type === 'diagramme' && (
              <small>Une ligne par donnée : « Libellé: valeur ».</small>
            )}
          </label>
        )}

        <label>
          Narration (texte)
          <textarea {...register('narrationTexte')} placeholder="Texte destiné à la narration" rows={3} />
        </label>

        <div className="form-grid-2">
          <label>
            Durée (ms)
            <input type="number" {...register('dureeMs', { valueAsNumber: true })} />
            {errors.dureeMs && <span className="error">{errors.dureeMs.message}</span>}
          </label>
          <label>
            Fond
            <input type="color" {...register('backgroundColor')} />
          </label>
        </div>

        <label>
          Mise en page
          <select {...register('layout')}>
            <option value="centered">Centrée</option>
            <option value="top">Haut</option>
            <option value="split-left">Moitié gauche</option>
            <option value="split-right">Moitié droite</option>
          </select>
        </label>

        <div className="form-grid-2">
          <label>
            Transition
            <select {...register('transitionType')}>
              <option value="fade">Fondu</option>
              <option value="slide-left">Glissement gauche</option>
              <option value="slide-right">Glissement droite</option>
              <option value="none">Aucune</option>
            </select>
          </label>
          <label>
            Transition (ms)
            <input type="number" {...register('transitionDurationMs', { valueAsNumber: true })} />
          </label>
        </div>

        <p className="scene-type-info">Ordre {selectedScene.ordre} · {selectedScene.type}</p>
      </form>
    </section>
  )
}
