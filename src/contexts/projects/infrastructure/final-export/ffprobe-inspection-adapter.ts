import { existsSync } from 'node:fs'
import { execa } from 'execa'
import type { InspectionMediaPort, MediaInspection, MediaStreamInfo } from '../../application/ports/inspection-media.port'

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  pix_fmt?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  sample_rate?: string
  duration?: string
}

interface FfprobePayload {
  streams?: FfprobeStream[]
  format?: { format_name?: string; duration?: string }
}

function ratio(value: string | undefined): number | null {
  if (!value) return null
  const [a, b] = value.split('/').map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return a / b
}

function secondsToMs(value: string | undefined): number | null {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null
}

function mapStream(stream: FfprobeStream): MediaStreamInfo {
  const codecType: MediaStreamInfo['codecType'] = stream.codec_type === 'video' ? 'video' : stream.codec_type === 'audio' ? 'audio' : 'other'
  return {
    codecType,
    codecName: stream.codec_name ?? null,
    width: typeof stream.width === 'number' ? stream.width : null,
    height: typeof stream.height === 'number' ? stream.height : null,
    pixelFormat: stream.pix_fmt ?? null,
    fps: ratio(stream.avg_frame_rate) ?? ratio(stream.r_frame_rate),
    sampleRate: stream.sample_rate ? Number(stream.sample_rate) : null,
    durationMs: secondsToMs(stream.duration)
  }
}

export function parseFfprobeInspection(stdout: string): MediaInspection {
  let parsed: FfprobePayload
  try {
    parsed = JSON.parse(stdout) as FfprobePayload
  } catch {
    throw new Error('FFPROBE_INVALID_JSON')
  }
  const durationMs = secondsToMs(parsed.format?.duration)
  if (durationMs === null || durationMs <= 0) throw new Error('FFPROBE_INVALID_DURATION')
  return {
    formatName: parsed.format?.format_name ?? '',
    durationMs,
    streams: (parsed.streams ?? []).map(mapStream)
  }
}

export class FFprobeInspectionAdapter implements InspectionMediaPort {
  constructor(private readonly ffprobeExecutable: string, private readonly timeoutMs = 60_000) {}

  async inspect(filePath: string, signal?: AbortSignal): Promise<MediaInspection> {
    if (!existsSync(this.ffprobeExecutable)) throw new Error('FFPROBE_NOT_FOUND')
    if (!existsSync(filePath)) throw new Error('FINAL_EXPORT_INPUT_MISSING')
    try {
      const result = await execa(this.ffprobeExecutable, [
        '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath
      ], {
        shell: false,
        cancelSignal: signal,
        timeout: this.timeoutMs,
        killSignal: 'SIGKILL'
      })
      return parseFfprobeInspection(result.stdout)
    } catch (error) {
      if (signal?.aborted) throw new Error('FINAL_EXPORT_CANCELLED')
      const maybe = error as { timedOut?: boolean; code?: string }
      if (maybe.timedOut) throw new Error('FFPROBE_TIMEOUT')
      if (maybe.code === 'ENOENT') throw new Error('FFPROBE_NOT_FOUND')
      if (error instanceof Error && error.message.startsWith('FFPROBE_')) throw error
      throw new Error(`FFPROBE_INVALID_MEDIA:${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
