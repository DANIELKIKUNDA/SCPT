import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { NarrationFilesystem } from '../narration-filesystem'

function makePcmWav(sampleRate = 8000, seconds = 0.25): Buffer {
  const sampleCount = Math.floor(sampleRate * seconds)
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

describe('NarrationFilesystem', () => {
  let root: string
  let projectDir: string
  let sourcePath: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'scpt-narration-fs-'))
    projectDir = join(root, 'project with spaces')
    sourcePath = join(root, 'voix originale.wav')
    writeFileSync(sourcePath, makePcmWav())
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('copies a real WAV without modifying the source and reads it back', async () => {
    const before = createHash('sha256').update(readFileSync(sourcePath)).digest('hex')
    const fsPort = new NarrationFilesystem(projectDir)
    const imported = await fsPort.importAudio(sourcePath)

    expect(imported.cheminRelatif.startsWith('audio/narration/')).toBe(true)
    expect(imported.dureeMs).toBeGreaterThan(0)
    expect(imported.checksum).toBe(before)
    expect(createHash('sha256').update(readFileSync(sourcePath)).digest('hex')).toBe(before)

    const payload = await fsPort.readBase64(imported.cheminRelatif)
    expect(payload.mimeType).toMatch(/wav/)
    expect(Buffer.from(payload.base64, 'base64').length).toBeGreaterThan(44)
  })

  it('uses collision-safe names instead of overwriting an existing import', async () => {
    const fsPort = new NarrationFilesystem(projectDir)
    const first = await fsPort.importAudio(sourcePath)
    const second = await fsPort.importAudio(sourcePath)
    expect(second.cheminRelatif).not.toBe(first.cheminRelatif)
  })

  it('rejects a path that escapes the project when reading', async () => {
    const fsPort = new NarrationFilesystem(projectDir)
    await expect(fsPort.readBase64('../outside.wav')).rejects.toThrow(/escapes/)
  })
})
