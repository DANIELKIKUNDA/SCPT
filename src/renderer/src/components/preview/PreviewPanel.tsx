import { useMemo, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Maximize2, Pause, Play, RotateCcw } from 'lucide-react'
import { ProjectComposition } from '../../../../remotion/compositions/ProjectComposition'
import type {
  PreviewMedia,
  PreviewScene,
  PreviewThemeId
} from '../../../../remotion/types/preview-types'
import {
  PREVIEW_FPS,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  buildTimeline
} from '../../../../remotion/utils/timeline'
import type { MediaDto } from '../../../../shared/types/electron-api'
import { useEditorStore } from '../../stores/editor-store'

interface PreviewPanelProps {
  medias: MediaDto[]
  reduceMotion: boolean
}

export function PreviewPanel({ medias, reduceMotion }: PreviewPanelProps): JSX.Element {
  const playerRef = useRef<PlayerRef>(null)
  const scenes = useEditorStore((state) => state.scenes)
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId)
  const [mode, setMode] = useState<'scene' | 'project'>('project')
  const [themeId, setThemeId] = useState<PreviewThemeId>('dark')

  const mediaMap = useMemo(() => new Map(medias.map((media) => [media.id, media])), [medias])

  const previewScenes = useMemo<PreviewScene[]>(() => {
    const source = mode === 'scene'
      ? scenes.filter((scene) => scene.id === selectedSceneId)
      : scenes

    return source.map((scene, index) => {
      const mediaDto = scene.mediaId ? mediaMap.get(scene.mediaId) : undefined
      const media: PreviewMedia | null = mediaDto
        ? {
            id: mediaDto.id,
            previewUrl: mediaDto.previewUrl,
            statut: mediaDto.statut,
            mimeType: mediaDto.mimeType,
            nomOriginal: mediaDto.nomOriginal,
            largeur: mediaDto.largeur,
            hauteur: mediaDto.hauteur
          }
        : null

      return {
        id: scene.id,
        ordre: mode === 'scene' ? index + 1 : scene.ordre,
        type: scene.type,
        titre: scene.titre,
        texteAffiche: scene.texteAffiche,
        dureeMs: scene.dureeMs,
        composition: scene.composition,
        transition: scene.transition,
        media
      }
    })
  }, [mediaMap, mode, scenes, selectedSceneId])

  const timeline = useMemo(() => buildTimeline(previewScenes), [previewScenes])
  const durationInFrames = Math.max(1, timeline.totalFrames)

  return (
    <section className="preview-panel" aria-label="Prévisualisation Remotion">
      <div className="preview-toolbar">
        <div className="segmented-control" aria-label="Niveau de prévisualisation">
          <button
            className={mode === 'scene' ? 'active' : ''}
            onClick={() => setMode('scene')}
            disabled={!selectedSceneId}
          >
            Scène
          </button>
          <button className={mode === 'project' ? 'active' : ''} onClick={() => setMode('project')}>
            Projet
          </button>
        </div>

        <div className="preview-meta">
          <span>16:9 · 1920×1080 · {PREVIEW_FPS} fps</span>
          <span>{(durationInFrames / PREVIEW_FPS).toFixed(1)} s</span>
        </div>

        <select
          className="preview-theme-select"
          aria-label="Thème de prévisualisation"
          value={themeId}
          onChange={(event) => setThemeId(event.target.value as PreviewThemeId)}
        >
          <option value="dark">Thème sombre</option>
          <option value="light">Thème clair</option>
        </select>
      </div>

      <div className="player-stage">
        <Player
          ref={playerRef}
          component={ProjectComposition}
          inputProps={{ scenes: previewScenes, themeId, reduceMotion }}
          durationInFrames={durationInFrames}
          compositionWidth={PREVIEW_WIDTH}
          compositionHeight={PREVIEW_HEIGHT}
          fps={PREVIEW_FPS}
          controls
          style={{ width: '100%', aspectRatio: '16 / 9', background: '#05070d' }}
        />
      </div>

      <div className="preview-actions">
        <button className="icon-btn labeled" onClick={() => playerRef.current?.play()} title="Lecture">
          <Play size={15} /> Lecture
        </button>
        <button className="icon-btn labeled" onClick={() => playerRef.current?.pause()} title="Pause">
          <Pause size={15} /> Pause
        </button>
        <button className="icon-btn labeled" onClick={() => playerRef.current?.seekTo(0)} title="Retour au début">
          <RotateCcw size={15} /> Début
        </button>
        <span className="preview-quality"><Maximize2 size={14} /> Aperçu déterministe</span>
      </div>
    </section>
  )
}
