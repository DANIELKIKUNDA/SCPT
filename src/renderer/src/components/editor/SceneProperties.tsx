import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditorStore } from '../../stores/editor-store'
import { Trash2, Copy } from 'lucide-react'

const sceneSchema = z.object({
  titre: z.string().optional(),
  narrationTexte: z.string().optional(),
  texteAffiche: z.string().optional(),
  dureeMs: z.number().min(100, 'Durée minimum 100ms').max(300000, 'Max 5 minutes')
})

type SceneFormData = z.infer<typeof sceneSchema>

export function SceneProperties() {
  const selectedScene = useEditorStore((s) => s.selectedScene())
  const updateScene = useEditorStore((s) => s.updateScene)
  const projectId = useEditorStore((s) => s.projectId)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SceneFormData>({
    resolver: zodResolver(sceneSchema),
    defaultValues: { titre: '', narrationTexte: '', texteAffiche: '', dureeMs: 5000 }
  })

  useEffect(() => {
    if (selectedScene) {
      reset({
        titre: selectedScene.titre ?? '',
        narrationTexte: selectedScene.narrationTexte ?? '',
        texteAffiche: selectedScene.texteAffiche ?? '',
        dureeMs: selectedScene.dureeMs
      })
    }
  }, [selectedScene?.id, reset])

  const onSubmit = useCallback((data: SceneFormData) => {
    if (!selectedScene || !projectId) return
    updateScene(selectedScene.id, {
      titre: data.titre || null,
      narrationTexte: data.narrationTexte || null,
      texteAffiche: data.texteAffiche || null,
      dureeMs: data.dureeMs
    })
  }, [selectedScene, projectId, updateScene])

  if (!selectedScene) {
    return <div className="scene-properties-empty">Sélectionnez une scène</div>
  }

  return (
    <div className="scene-properties-panel">
      <div className="scene-props-header">
        <span>Propriétés — {selectedScene.type}</span>
        <div className="scene-props-actions">
          <button
            className="icon-btn"
            title="Dupliquer"
            onClick={() => window.electronAPI?.scenesDuplicate?.({ sceneId: selectedScene.id, projetId: projectId! })}
          >
            <Copy size={14} />
          </button>
          <button
            className="icon-btn danger"
            title="Supprimer"
            onClick={() => {
              if (confirm('Supprimer cette scène ?')) {
                window.electronAPI?.scenesDelete?.({ sceneId: selectedScene.id, projetId: projectId! })
              }
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <form onChange={handleSubmit(onSubmit)} className="scene-form">
        <label>
          Titre
          <input {...register('titre')} placeholder="Titre de la scène" />
        </label>
        <label>
          Texte affiché
          <textarea {...register('texteAffiche')} placeholder="Texte visible à l'écran" rows={3} />
        </label>
        <label>
          Narration (texte)
          <textarea {...register('narrationTexte')} placeholder="Texte lu par la voix" rows={3} />
        </label>
        <label>
          Durée (ms)
          <input type="number" {...register('dureeMs', { valueAsNumber: true })} />
          {errors.dureeMs && <span className="error">{errors.dureeMs.message}</span>}
        </label>
        <p className="scene-type-info">Type : {selectedScene.type} | Ordre : {selectedScene.ordre}</p>
      </form>
    </div>
  )
}