import { existsSync } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

function unpackAsarPath(value: string): string {
  return value.includes('app.asar') ? value.replace('app.asar', 'app.asar.unpacked') : value
}

function assertBinary(value: string | null | undefined, code: string): string {
  if (!value) throw new Error(code)
  const resolved = unpackAsarPath(value)
  if (!existsSync(resolved)) throw new Error(code)
  return resolved
}

export function resolveFfmpegExecutable(): string {
  return assertBinary(ffmpegPath, 'FFMPEG_NOT_FOUND')
}

export function resolveFfprobeExecutable(): string {
  return assertBinary(ffprobeStatic?.path, 'FFPROBE_NOT_FOUND')
}

export function resolvePackagedBinaryPathForTest(value: string): string {
  return unpackAsarPath(value)
}
