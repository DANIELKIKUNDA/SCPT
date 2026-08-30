export interface MediaStreamInfo {
  codecType: 'video' | 'audio' | 'other'
  codecName: string | null
  width: number | null
  height: number | null
  pixelFormat: string | null
  fps: number | null
  sampleRate: number | null
  durationMs: number | null
}

export interface MediaInspection {
  formatName: string
  durationMs: number
  streams: MediaStreamInfo[]
}

export interface InspectionMediaPort {
  inspect(filePath: string, signal?: AbortSignal): Promise<MediaInspection>
}
