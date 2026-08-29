import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SubtitleFilesystem } from '../subtitle-filesystem'

describe('SubtitleFilesystem', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scpt-subtitles-'))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('writes a canonical project copy and the user-selected copy', async () => {
    const destination = join(dir, 'exports', 'lesson.srt')
    const result = await new SubtitleFilesystem(dir).exportText({
      langue: 'fr',
      format: 'srt',
      content: '1\n00:00:00,000 --> 00:00:01,000\nBonjour\n',
      destinationPath: destination
    })
    expect(result.relativeProjectPath).toBe('subtitles/fr/master.srt')
    expect(result.fileName).toBe('lesson.srt')
    expect(existsSync(join(dir, 'subtitles', 'fr', 'master.srt'))).toBe(true)
    expect(readFileSync(destination, 'utf8')).toContain('Bonjour')
  })

  it('sanitizes the language directory', async () => {
    const destination = join(dir, 'lesson.vtt')
    const result = await new SubtitleFilesystem(dir).exportText({
      langue: '../fr',
      format: 'vtt',
      content: 'WEBVTT\n',
      destinationPath: destination
    })
    expect(result.relativeProjectPath).toBe('subtitles/___fr/master.vtt')
  })
})
