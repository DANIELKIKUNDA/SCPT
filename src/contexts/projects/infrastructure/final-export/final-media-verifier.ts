import type { MediaInspection } from '../../application/ports/inspection-media.port'

export interface FinalMediaExpectation {
  width: number
  height: number
  durationMs: number
  durationToleranceMs?: number
}

export interface VerifiedFinalMedia {
  dureeMs: number
  largeur: number
  hauteur: number
  fps: number
  codecVideo: 'h264'
  pixelFormat: 'yuv420p'
  codecAudio: 'aac'
  audioSampleRate: 48000
}

export function verifyFinalMedia(
  inspection: MediaInspection,
  expected: FinalMediaExpectation
): VerifiedFinalMedia {
  if (!inspection.formatName.toLowerCase().includes('mp4')) throw new Error('FINAL_EXPORT_INVALID_CONTAINER')
  const video = inspection.streams.find((stream) => stream.codecType === 'video')
  const audio = inspection.streams.find((stream) => stream.codecType === 'audio')
  if (!video) throw new Error('FINAL_EXPORT_VIDEO_STREAM_MISSING')
  if (!audio) throw new Error('FINAL_EXPORT_AUDIO_STREAM_MISSING')
  if (video.codecName !== 'h264') throw new Error('FINAL_EXPORT_VIDEO_CODEC_INVALID')
  if (video.pixelFormat !== 'yuv420p') throw new Error('FINAL_EXPORT_PIXEL_FORMAT_INVALID')
  if (video.width !== expected.width || video.height !== expected.height) throw new Error('FINAL_EXPORT_RESOLUTION_INVALID')
  if (video.fps === null || Math.abs(video.fps - 30) > 0.1) throw new Error('FINAL_EXPORT_FPS_INVALID')
  if (audio.codecName !== 'aac') throw new Error('FINAL_EXPORT_AUDIO_CODEC_INVALID')
  if (audio.sampleRate !== 48000) throw new Error('FINAL_EXPORT_AUDIO_RATE_INVALID')
  const tolerance = expected.durationToleranceMs ?? 250
  if (Math.abs(inspection.durationMs - expected.durationMs) > tolerance) throw new Error('FINAL_EXPORT_DURATION_INVALID')
  if (audio.durationMs !== null && Math.abs(audio.durationMs - inspection.durationMs) > tolerance) {
    throw new Error('FINAL_EXPORT_AUDIO_VIDEO_DESYNC')
  }
  return {
    dureeMs: inspection.durationMs,
    largeur: expected.width,
    hauteur: expected.height,
    fps: video.fps,
    codecVideo: 'h264',
    pixelFormat: 'yuv420p',
    codecAudio: 'aac',
    audioSampleRate: 48000
  }
}
