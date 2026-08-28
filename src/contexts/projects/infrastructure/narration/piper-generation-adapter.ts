import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, rm } from 'fs/promises'
import { dirname, join, resolve, sep } from 'path'
import { execa } from 'execa'
import PQueue from 'p-queue'
import { parseFile } from 'music-metadata'
import { ulid } from 'ulid'
import type { GenerationVoixPort, GenerateVoiceInput, GeneratedVoiceFile } from '../../application/ports/generation-voix.port'

const generationQueue = new PQueue({ concurrency: 1 })
const DEFAULT_TIMEOUT_MS = 120_000

function toPosixRelative(path: string): string {
  return path.split(sep).join('/')
}

export interface PiperVoiceConfig {
  voiceId: string
  modelPath: string
}

export class PiperGenerationAdapter implements GenerationVoixPort {
  constructor(
    private readonly projectDir: string,
    private readonly piperExe: string,
    private readonly voices: readonly PiperVoiceConfig[]
  ) {}

  async generate(input: GenerateVoiceInput): Promise<GeneratedVoiceFile> {
    const texte = input.texte.trim()
    if (!texte) throw new Error('EMPTY_TEXT')
    if (!existsSync(this.piperExe)) throw new Error('PIPER_NOT_FOUND')

    const voice = this.voices.find((candidate) => candidate.voiceId === input.voixId)
    if (!voice || !existsSync(voice.modelPath)) throw new Error('VOICE_MODEL_ERROR')

    const result = await generationQueue.add(async () => {
      const narrationDir = join(this.projectDir, 'audio', 'narration')
      const tempDir = join(this.projectDir, 'audio', 'temp')
      await Promise.all([
        mkdir(narrationDir, { recursive: true }),
        mkdir(tempDir, { recursive: true })
      ])

      const token = ulid()
      const tempOutput = join(tempDir, `piper-${token}.wav`)
      const finalOutput = join(narrationDir, `narration-${token}.wav`)
      try {
        await execa(this.piperExe, ['--model', voice.modelPath, '--output_file', tempOutput], {
          shell: false,
          input: texte,
          cancelSignal: input.signal,
          timeout: DEFAULT_TIMEOUT_MS,
          killSignal: 'SIGKILL',
          cwd: dirname(this.piperExe)
        })

        const metadata = await parseFile(tempOutput)
        const durationSeconds = metadata.format.duration
        if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          throw new Error('PIPER_INVALID_WAV')
        }
        const data = await readFile(tempOutput)
        const checksum = createHash('sha256').update(data).digest('hex')
        await rename(tempOutput, finalOutput)
        return {
          cheminRelatif: toPosixRelative(finalOutput.slice(resolve(this.projectDir).length + 1)),
          dureeMs: Math.round(durationSeconds * 1000),
          checksum
        }
      } catch (error) {
        await rm(tempOutput, { force: true })
        if (input.signal?.aborted) throw new Error('NARRATION_CANCELLED')
        const maybe = error as { timedOut?: boolean; exitCode?: number }
        if (maybe.timedOut) throw new Error('PIPER_TIMEOUT')
        if (typeof maybe.exitCode === 'number' && maybe.exitCode !== 0) throw new Error('VOICE_MODEL_ERROR')
        throw error
      }
    })
    if (!result) throw new Error('PIPER_GENERATION_ABORTED')
    return result
  }
}

export function defaultFrenchVoice(rootDir: string): PiperVoiceConfig {
  return {
    voiceId: 'fr_FR-siwis-medium',
    modelPath: join(rootDir, 'resources', 'voices', 'fr', 'fr_FR-siwis-medium', 'model.onnx')
  }
}

export function defaultPiperExecutable(rootDir: string): string {
  return join(rootDir, 'resources', 'piper', 'windows-x64', 'piper.exe')
}
