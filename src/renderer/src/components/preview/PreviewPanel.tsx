import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Maximize2, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react'
import { ProjectComposition } from '../../../../remotion/compositions/ProjectComposition'
import type {
  PreviewDeclination,
  PreviewMedia,
  PreviewScene,
  PreviewSubtitleSegment,
  PreviewThemeId
} from '../../../../remotion/types/preview-types'
import {
  PREVIEW_FPS,
  buildTimeline
} from '../../../../remotion/utils/timeline'
import { DEFAULT_PREVIEW_DECLINATION } from '../../../../remotion/utils/declination-layout'
import { shiftSubtitlesToWindow, subtitleDurationInFrames } from '../../../../remotion/utils/subtitles'
import type { DeclinaisonDto, MediaDto, SubtitleTrackDto } from '../../../../shared/types/electron-api'
import { useEditorStore } from '../../stores/editor-store'

interface PreviewPanelProps {
  medias: MediaDto[]
  reduceMotion: boolean
  subtitles: SubtitleTrackDto | null
  showSubtitles: boolean
  declination: DeclinaisonDto | null
}

function toPreviewDeclination(value: DeclinaisonDto | null): PreviewDeclination {
  if (!value || value.obsolete) return DEFAULT_PREVIEW_DECLINATION
  return {
    id: value.id,
    format: value.format,
    resolution: value.resolution,
    langue: value.langue,
    profilExport: value.profilExport,
    safeZone: value.safeZone,
    overrides: value.overrides
  }
}

function formatLabel(format: PreviewDeclination['format']): string {
  if (format === 'VERTICAL_9_16') return '9:16'
  if (format === 'CARRE_1_1') return '1:1'
  return '16:9'
}

export function PreviewPanel({ medias, reduceMotion, subtitles, showSubtitles, declination }: PreviewPanelProps): JSX.Element {
  const playerRef = useRef<PlayerRef>(null)
  const scenes = useEditorStore((state) => state.scenes)
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId)
  const [mode, setMode] = useState<'scene' | 'project'>('project')
  const [themeId, setThemeId] = useState<PreviewThemeId>('dark')
  const [showSafeZone, setShowSafeZone] = useState(false)

  const mediaMap = useMemo(() => new Map(medias.map((media) => [media.id, media])), [medias])
  const previewDeclination = useMemo(() => toPreviewDeclination(declination), [declination])

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

  const previewSubtitles = useMemo<PreviewSubtitleSegment[]>(() => {
    if (!showSubtitles || !subtitles) return []
    if (mode === 'project') {
      return subtitles.segments.map((segment) => ({
        id: segment.id,
        debutMs: segment.debutMs,
        finMs: segment.finMs,
        texte: segment.texte,
        position: segment.position,
        style: segment.style
      }))
    }

    const orderedScenes = [...scenes].sort((a, b) => a.ordre - b.ordre)
    let offsetMs = 0
    const selected = orderedScenes.find((scene) => {
      if (scene.id === selectedSceneId) return true
      offsetMs += scene.dureeMs
      return false
    })
    if (!selected) return []
    const projectSegments: PreviewSubtitleSegment[] = subtitles.segments.map((segment) => ({
      id: segment.id,
      debutMs: segment.debutMs,
      finMs: segment.finMs,
      texte: segment.texte,
      position: segment.position,
      style: segment.style
    }))
    return shiftSubtitlesToWindow(projectSegments, offsetMs, selected.dureeMs)
  }, [mode, scenes, selectedSceneId, showSubtitles, subtitles])

  const timeline = useMemo(() => buildTimeline(previewScenes), [previewScenes])
  const durationInFrames = Math.max(
    1,
    timeline.totalFrames,
    subtitleDurationInFrames(previewSubtitles, PREVIEW_FPS)
  )
  const aspectRatio = `${previewDeclination.resolution.width} / ${previewDeclination.resolution.height}`
  const playerStyle: CSSProperties = previewDeclination.format === 'HORIZONTAL_16_9'
    ? { width: '100%', maxHeight: '100%', aspectRatio, background: '#05070d' }
    : { height: '100%', maxWidth: '100%', aspectRatio, background: '#05070d' }

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
            {declination ? 'Déclinaison' : 'Projet'}
          </button>
        </div>

        <div className="preview-meta">
          <span>{formatLabel(previewDeclination.format)} · {previewDeclination.resolution.width}×{previewDeclination.resolution.height} · {PREVIEW_FPS} fps</span>
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

      <div className={`player-stage format-${previewDeclination.format.toLowerCase()}`}>
        <Player
          ref={playerRef}
          component={ProjectComposition}
          inputProps={{
            scenes: previewScenes,
            themeId,
            reduceMotion,
            subtitles: previewSubtitles,
            declination: previewDeclination,
            showSafeZone
          }}
          durationInFrames={durationInFrames}
          compositionWidth={previewDeclination.resolution.width}
          compositionHeight={previewDeclination.resolution.height}
          fps={PREVIEW_FPS}
          controls
          style={playerStyle}
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
        <button
          className={`icon-btn labeled ${showSafeZone ? 'active' : ''}`}
          onClick={() => setShowSafeZone((value) => !value)}
          title="Afficher les zones sûres"
        >
          <ShieldCheck size={15} /> Zones sûres
        </button>
        <span className="preview-quality"><Maximize2 size={14} /> Recomposition déterministe</span>
      </div>
    </section>
  )
}
