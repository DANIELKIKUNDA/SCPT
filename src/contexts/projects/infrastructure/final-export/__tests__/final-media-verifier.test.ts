import { describe, expect, it } from 'vitest'
import type { MediaInspection } from '../../../application/ports/inspection-media.port'
import { verifyFinalMedia } from '../final-media-verifier'

function validInspection(): MediaInspection {
  return {
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    durationMs: 3000,
    streams: [
      {
        codecType: 'video', codecName: 'h264', width: 1920, height: 1080,
        pixelFormat: 'yuv420p', fps: 30, sampleRate: null, durationMs: 3000
      },
      {
        codecType: 'audio', codecName: 'aac', width: null, height: null,
        pixelFormat: null, fps: null, sampleRate: 48000, durationMs: 3000
      }
    ]
  }
}

const expected = { width: 1920, height: 1080, durationMs: 3000 }

describe('verifyFinalMedia', () => {
  it('accepts the canonical SCPT final MP4 profile', () => {
    const result = verifyFinalMedia(validInspection(), expected)
    expect(result).toEqual({
      dureeMs: 3000,
      largeur: 1920,
      hauteur: 1080,
      fps: 30,
      codecVideo: 'h264',
      pixelFormat: 'yuv420p',
      codecAudio: 'aac',
      audioSampleRate: 48000
    })
  })

  it('rejects a non-MP4 container', () => {
    const input = validInspection()
    input.formatName = 'matroska,webm'
    expect(() => verifyFinalMedia(input, expected)).toThrow('FINAL_EXPORT_INVALID_CONTAINER')
  })

  it('rejects a missing audio stream', () => {
    const input = validInspection()
    input.streams = input.streams.filter((stream) => stream.codecType !== 'audio')
    expect(() => verifyFinalMedia(input, expected)).toThrow('FINAL_EXPORT_AUDIO_STREAM_MISSING')
  })

  it('rejects an unexpected video codec or pixel format', () => {
    const codec = validInspection()
    codec.streams[0].codecName = 'hevc'
    expect(() => verifyFinalMedia(codec, expected)).toThrow('FINAL_EXPORT_VIDEO_CODEC_INVALID')

    const pixel = validInspection()
    pixel.streams[0].pixelFormat = 'yuv444p'
    expect(() => verifyFinalMedia(pixel, expected)).toThrow('FINAL_EXPORT_PIXEL_FORMAT_INVALID')
  })

  it('rejects wrong resolution and frame rate', () => {
    const resolution = validInspection()
    resolution.streams[0].width = 1280
    expect(() => verifyFinalMedia(resolution, expected)).toThrow('FINAL_EXPORT_RESOLUTION_INVALID')

    const fps = validInspection()
    fps.streams[0].fps = 25
    expect(() => verifyFinalMedia(fps, expected)).toThrow('FINAL_EXPORT_FPS_INVALID')
  })

  it('rejects wrong audio codec or sample rate', () => {
    const codec = validInspection()
    codec.streams[1].codecName = 'mp3'
    expect(() => verifyFinalMedia(codec, expected)).toThrow('FINAL_EXPORT_AUDIO_CODEC_INVALID')

    const rate = validInspection()
    rate.streams[1].sampleRate = 44100
    expect(() => verifyFinalMedia(rate, expected)).toThrow('FINAL_EXPORT_AUDIO_RATE_INVALID')
  })

  it('rejects a wrong final duration', () => {
    const input = validInspection()
    input.durationMs = 3400
    expect(() => verifyFinalMedia(input, expected)).toThrow('FINAL_EXPORT_DURATION_INVALID')
  })

  it('rejects audio/video desynchronization even when container duration is valid', () => {
    const input = validInspection()
    input.streams[1].durationMs = 2500
    expect(() => verifyFinalMedia(input, expected)).toThrow('FINAL_EXPORT_AUDIO_VIDEO_DESYNC')
  })
})
