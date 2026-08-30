export interface EncodageVideoRequest {
  videoInputPath: string
  audioInputPath: string
  outputPath: string
  expectedDurationMs: number
  width: number
  height: number
}

export interface EncodageVideoResult {
  outputPath: string
  loudness: {
    inputI: number
    inputTp: number
    inputLra: number
    inputThresh: number
    targetOffset: number
  }
}

export interface EncodageVideoPort {
  encodeFinal(
    request: EncodageVideoRequest,
    options: { signal: AbortSignal; onProgress: (progress: number) => void | Promise<void> }
  ): Promise<EncodageVideoResult>
}
