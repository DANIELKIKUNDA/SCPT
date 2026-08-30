import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { execa } from 'execa'
import type { EncodageVideoPort, EncodageVideoRequest, EncodageVideoResult } from '../../application/ports/encodage-video.port'

const DEFAULT_TIMEOUT_MS = 5 * 60_000
const LOUDNESS_I = -16
const LOUDNESS_TP = -1
const LOUDNESS_LRA = 11

export interface LoudnormAnalysis {
  inputI: number
  inputTp: number
  inputLra: number
  inputThresh: number
  targetOffset: number
}

function asFinite(value: unknown, key: string): number {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`FFMPEG_LOUDNORM_INVALID_${key}`)
  return number
}

export function parseLoudnormAnalysis(stderr: string): LoudnormAnalysis {
  const marker = stderr.lastIndexOf('{')
  if (marker < 0) throw new Error('FFMPEG_LOUDNORM_ANALYSIS_MISSING')
  const end = stderr.indexOf('}', marker)
  if (end < 0) throw new Error('FFMPEG_LOUDNORM_ANALYSIS_MISSING')
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(stderr.slice(marker, end + 1)) as Record<string, unknown>
  } catch {
    throw new Error('FFMPEG_LOUDNORM_ANALYSIS_INVALID')
  }
  return {
    inputI: asFinite(payload.input_i, 'INPUT_I'),
    inputTp: asFinite(payload.input_tp, 'INPUT_TP'),
    inputLra: asFinite(payload.input_lra, 'INPUT_LRA'),
    inputThresh: asFinite(payload.input_thresh, 'INPUT_THRESH'),
    targetOffset: asFinite(payload.target_offset, 'TARGET_OFFSET')
  }
}

export function ffmpegRefusedOverwrite(stderr: string): boolean {
  return /already exists[.\s]/i.test(stderr) || /not overwriting/i.test(stderr)
}

function parseProgressLine(line: string, expectedDurationMs: number): number | null {
  if (line === 'progress=end') return 1
  if (!line.startsWith('out_time_ms=')) return null
  const microseconds = Number(line.slice('out_time_ms='.length))
  if (!Number.isFinite(microseconds) || expectedDurationMs <= 0) return null
  return Math.min(1, Math.max(0, microseconds / 1000 / expectedDurationMs))
}

function diagnostic(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function mapProcessError(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) return new Error('FINAL_EXPORT_CANCELLED')
  const maybe = error as { timedOut?: boolean; stderr?: string; code?: string; exitCode?: number }
  if (maybe.timedOut) return new Error('FFMPEG_TIMEOUT')
  if (maybe.code === 'ENOENT') return new Error('FFMPEG_NOT_FOUND')
  if (typeof maybe.stderr === 'string' && ffmpegRefusedOverwrite(maybe.stderr)) return new Error('FINAL_EXPORT_OUTPUT_EXISTS')
  return new Error(`FFMPEG_ENCODING_FAILED:${diagnostic(error)}`)
}

export class FFmpegEncodingAdapter implements EncodageVideoPort {
  constructor(
    private readonly ffmpegExecutable: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  async encodeFinal(
    request: EncodageVideoRequest,
    options: { signal: AbortSignal; onProgress: (progress: number) => void | Promise<void> }
  ): Promise<EncodageVideoResult> {
    if (!existsSync(this.ffmpegExecutable)) throw new Error('FFMPEG_NOT_FOUND')
    if (!existsSync(request.videoInputPath)) throw new Error('FINAL_EXPORT_VIDEO_MISSING')
    if (!existsSync(request.audioInputPath)) throw new Error('FINAL_EXPORT_AUDIO_MISSING')
    if (options.signal.aborted) throw new Error('FINAL_EXPORT_CANCELLED')

    await rm(request.outputPath, { force: true })
    const loudness = await this.analyzeLoudness(request.audioInputPath, options.signal)
    if (options.signal.aborted) throw new Error('FINAL_EXPORT_CANCELLED')

    const durationSeconds = (request.expectedDurationMs / 1000).toFixed(3)
    const filter = [
      `loudnorm=I=${LOUDNESS_I}:TP=${LOUDNESS_TP}:LRA=${LOUDNESS_LRA}`,
      `measured_I=${loudness.inputI}:measured_TP=${loudness.inputTp}:measured_LRA=${loudness.inputLra}`,
      `measured_thresh=${loudness.inputThresh}:offset=${loudness.targetOffset}:linear=true:print_format=summary`
    ].join(':') + `,aresample=48000,apad,atrim=duration=${durationSeconds}`

    const args = [
      '-hide_banner', '-nostdin', '-n',
      '-i', request.videoInputPath,
      '-i', request.audioInputPath,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-r', '30',
      '-af', filter,
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-t', durationSeconds,
      '-movflags', '+faststart',
      '-progress', 'pipe:1', '-nostats',
      request.outputPath
    ]

    try {
      const subprocess = execa(this.ffmpegExecutable, args, {
        shell: false,
        cancelSignal: options.signal,
        timeout: this.timeoutMs,
        killSignal: 'SIGKILL',
        stdout: 'pipe',
        stderr: 'pipe'
      })

      let buffer = ''
      subprocess.stdout?.on('data', (chunk: Buffer | string) => {
        buffer += chunk.toString()
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const value = parseProgressLine(line.trim(), request.expectedDurationMs)
          if (value !== null) void options.onProgress(value)
        }
      })

      const result = await subprocess
      if (ffmpegRefusedOverwrite(result.stderr)) throw new Error('FINAL_EXPORT_OUTPUT_EXISTS')
      if (options.signal.aborted) throw new Error('FINAL_EXPORT_CANCELLED')
      await options.onProgress(1)
      return { outputPath: request.outputPath, loudness }
    } catch (error) {
      await rm(request.outputPath, { force: true }).catch(() => undefined)
      if (error instanceof Error && error.message === 'FINAL_EXPORT_OUTPUT_EXISTS') throw error
      throw mapProcessError(error, options.signal)
    }
  }

  private async analyzeLoudness(audioPath: string, signal: AbortSignal): Promise<LoudnormAnalysis> {
    const nullSink = process.platform === 'win32' ? 'NUL' : '/dev/null'
    try {
      const result = await execa(this.ffmpegExecutable, [
        '-hide_banner', '-nostdin', '-i', audioPath,
        '-af', `loudnorm=I=${LOUDNESS_I}:TP=${LOUDNESS_TP}:LRA=${LOUDNESS_LRA}:print_format=json`,
        '-f', 'null', nullSink
      ], {
        shell: false,
        cancelSignal: signal,
        timeout: this.timeoutMs,
        killSignal: 'SIGKILL',
        stdout: 'pipe',
        stderr: 'pipe'
      })
      return parseLoudnormAnalysis(result.stderr)
    } catch (error) {
      throw mapProcessError(error, signal)
    }
  }
}
