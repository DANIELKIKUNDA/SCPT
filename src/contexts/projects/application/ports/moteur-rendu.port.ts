import type { ProjectCompositionProps } from '../../../../remotion/types/preview-types'

export interface RenderEngineProgress {
  /** 0..1 — value reported by the real Remotion renderer. */
  progress: number
}

export interface RenderEngineRequest {
  jobId: string
  entryPoint: string
  outputPath: string
  inputProps: ProjectCompositionProps
  compositionId: string
  browserExecutable: string
}

export interface RenderEngineResult {
  outputPath: string
}

export interface MoteurRenduPort {
  render(
    request: RenderEngineRequest,
    options: {
      signal: AbortSignal
      onProgress: (progress: RenderEngineProgress) => void | Promise<void>
    }
  ): Promise<RenderEngineResult>
}
