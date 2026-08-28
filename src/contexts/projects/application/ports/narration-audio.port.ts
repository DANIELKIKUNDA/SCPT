export interface ImportedNarrationAudio {
  cheminRelatif: string
  dureeMs: number
  checksum: string
  mimeType: string
  nomOriginal: string
}

export interface NarrationAudioPort {
  importAudio(sourcePath: string): Promise<ImportedNarrationAudio>
  readBase64(cheminRelatif: string): Promise<{ base64: string; mimeType: string }>
}
