export interface GeneratedVoiceFile {
  cheminRelatif: string
  dureeMs: number
  checksum: string
}

export interface GenerateVoiceInput {
  texte: string
  voixId: string
  signal?: AbortSignal
}

export interface GenerationVoixPort {
  generate(input: GenerateVoiceInput): Promise<GeneratedVoiceFile>
}
