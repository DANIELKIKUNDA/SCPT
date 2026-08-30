import { describe, expect, it } from 'vitest'
import { ffmpegRefusedOverwrite, parseLoudnormAnalysis } from '../ffmpeg-encoding-adapter'
import { resolvePackagedBinaryPathForTest } from '../ffmpeg-binary-resolver'

const analysis = `
[Parsed_loudnorm_0] {
\t"input_i" : "-23.10",
\t"input_tp" : "-4.20",
\t"input_lra" : "2.10",
\t"input_thresh" : "-33.50",
\t"output_i" : "-16.00",
\t"target_offset" : "0.12"
}
`

describe('Phase 10 FFmpeg helpers', () => {
  it('parses deterministic loudnorm JSON measurements', () => {
    expect(parseLoudnormAnalysis(analysis)).toEqual({
      inputI: -23.1,
      inputTp: -4.2,
      inputLra: 2.1,
      inputThresh: -33.5,
      targetOffset: 0.12
    })
  })

  it('rejects missing or malformed loudnorm analysis', () => {
    expect(() => parseLoudnormAnalysis('no json here')).toThrow('FFMPEG_LOUDNORM_ANALYSIS_MISSING')
    expect(() => parseLoudnormAnalysis('{not-json}')).toThrow('FFMPEG_LOUDNORM_ANALYSIS_INVALID')
  })

  it('detects ffmpeg-static overwrite refusal even when exit code may be zero', () => {
    expect(ffmpegRefusedOverwrite("File 'final.mp4' already exists. Exiting.")).toBe(true)
    expect(ffmpegRefusedOverwrite('Not overwriting - exiting')).toBe(true)
    expect(ffmpegRefusedOverwrite('video:120kB audio:20kB')).toBe(false)
  })

  it('maps packaged asar binary paths to app.asar.unpacked', () => {
    expect(resolvePackagedBinaryPathForTest('C:/App/resources/app.asar/node_modules/ffmpeg-static/ffmpeg.exe'))
      .toBe('C:/App/resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe')
    expect(resolvePackagedBinaryPathForTest('C:/Dev/SCPT/node_modules/ffmpeg-static/ffmpeg.exe'))
      .toBe('C:/Dev/SCPT/node_modules/ffmpeg-static/ffmpeg.exe')
  })
})
