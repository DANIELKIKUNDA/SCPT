import { interpolate } from 'remotion'
import type { CSSProperties } from 'react'
import type { SceneTransitionDto } from '../../shared/types/electron-api'

export function transitionStyle(params: {
  frame: number
  durationInFrames: number
  fps: number
  transition: SceneTransitionDto
  reduceMotion: boolean
}): CSSProperties {
  const { frame, durationInFrames, fps, transition, reduceMotion } = params
  if (reduceMotion || transition.type === 'none' || transition.durationMs <= 0 || durationInFrames <= 2) {
    return { opacity: 1, transform: 'none' }
  }

  const transitionFrames = Math.max(
    1,
    Math.min(Math.floor(durationInFrames / 2), Math.round((transition.durationMs / 1000) * fps))
  )
  const enter = interpolate(frame, [0, transitionFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const exitStart = Math.max(0, durationInFrames - transitionFrames)
  const exit = interpolate(frame, [exitStart, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const opacity = Math.min(enter, exit)

  if (transition.type === 'fade') return { opacity }

  const direction = transition.type === 'slide-left' ? 1 : -1
  const enterX = interpolate(enter, [0, 1], [direction * 80, 0])
  const exitX = interpolate(exit, [0, 1], [-direction * 80, 0])
  const translateX = frame < exitStart ? enterX : exitX
  return { opacity, transform: `translateX(${translateX}px)` }
}
