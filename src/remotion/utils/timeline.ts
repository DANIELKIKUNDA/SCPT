import type { PreviewScene } from '../types/preview-types'

export const PREVIEW_FPS = 30
export const PREVIEW_WIDTH = 1920
export const PREVIEW_HEIGHT = 1080

export interface TimelineScene {
  scene: PreviewScene
  from: number
  durationInFrames: number
}

export interface ProjectTimeline {
  scenes: TimelineScene[]
  totalFrames: number
}

export function durationMsToFrames(durationMs: number, fps: number = PREVIEW_FPS): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Scene duration must be positive')
  }
  return Math.max(1, Math.round((durationMs / 1000) * fps))
}

export function buildTimeline(scenes: PreviewScene[], fps: number = PREVIEW_FPS): ProjectTimeline {
  const ordered = [...scenes].sort((a, b) => a.ordre - b.ordre)
  let cursor = 0
  const timelineScenes = ordered.map((scene) => {
    const durationInFrames = durationMsToFrames(scene.dureeMs, fps)
    const item: TimelineScene = { scene, from: cursor, durationInFrames }
    cursor += durationInFrames
    return item
  })
  return { scenes: timelineScenes, totalFrames: cursor }
}

export function findSceneAtFrame(timeline: ProjectTimeline, frame: number): TimelineScene {
  const item = timeline.scenes.find(
    (candidate) => frame >= candidate.from && frame < candidate.from + candidate.durationInFrames
  )
  if (!item) throw new Error(`Scene not found for frame ${frame}`)
  return item
}
