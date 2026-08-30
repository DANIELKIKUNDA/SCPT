import { describe, expect, it } from 'vitest'
import { parseFfprobeInspection } from '../ffprobe-inspection-adapter'

const payload = JSON.stringify({
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '3.000000' },
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p', avg_frame_rate: '30/1', duration: '3.000000' },
    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', duration: '3.000000' }
  ]
})

describe('parseFfprobeInspection', () => {
  it('parses ffprobe JSON into deterministic typed media metadata', () => {
    const result = parseFfprobeInspection(payload)
    expect(result.formatName).toContain('mp4')
    expect(result.durationMs).toBe(3000)
    expect(result.streams[0]).toMatchObject({ codecType: 'video', codecName: 'h264', width: 1920, height: 1080, pixelFormat: 'yuv420p', fps: 30 })
    expect(result.streams[1]).toMatchObject({ codecType: 'audio', codecName: 'aac', sampleRate: 48000 })
  })

  it('falls back to r_frame_rate when avg_frame_rate is unusable', () => {
    const parsed = JSON.parse(payload)
    parsed.streams[0].avg_frame_rate = '0/0'
    parsed.streams[0].r_frame_rate = '30000/1000'
    expect(parseFfprobeInspection(JSON.stringify(parsed)).streams[0].fps).toBe(30)
  })

  it('rejects malformed JSON and missing positive duration', () => {
    expect(() => parseFfprobeInspection('{invalid')).toThrow('FFPROBE_INVALID_JSON')
    expect(() => parseFfprobeInspection(JSON.stringify({ format: { duration: '0' }, streams: [] })))
      .toThrow('FFPROBE_INVALID_DURATION')
  })
})
