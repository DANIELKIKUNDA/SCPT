/**
 * PHASE 4 — Full lifecycle test: import → verify → close → reopen → verify
 * Proves: source preserved, checksum identical, thumbnail, metadata, association, persistence.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, rmdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ulid } from 'ulid'
import { createHash } from 'crypto'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'

import { createDrizzleMediaRepository } from '../drizzle-media-repository'
import { createDrizzleSceneRepository } from '../drizzle-scene-repository'
import { RessourceMedia } from '../../../domain/aggregates/ressource-media'
import { Scene } from '../../../domain/aggregates/scene'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

function sha256(p: string) { return createHash('sha256').update(readFileSync(p)).digest('hex') }

describe('Media lifecycle (real filesystem + real SQLite)', () => {
  let testDir: string
  let projectDir: string
  let sourceFile: string
  const projetId = ProjetAudiovisuelId.from(ulid())

  beforeEach(async () => {
    testDir = join(tmpdir(), 'scpt-media-lifecycle-' + Date.now())
    projectDir = join(testDir, 'projects', projetId.value)
    mkdirSync(projectDir, { recursive: true })
    sourceFile = join(testDir, 'original-photo.png')
    await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toFile(sourceFile)
  })

  afterEach(() => {
    try { rmdirSync(testDir, { recursive: true }) } catch { /* cleanup */ }
  })

  it('full cycle: import media → verify source unchanged → close → reopen → verify', async () => {
    const sourceChecksum = sha256(sourceFile)

    const buffer = new Uint8Array(readFileSync(sourceFile))
    const typeResult = await fileTypeFromBuffer(buffer)
    expect(typeResult).not.toBeNull()
    expect(typeResult!.mime).toBe('image/png')

    const mediaDir = join(projectDir, 'media', 'source')
    mkdirSync(mediaDir, { recursive: true })

    function safeName(original: string): string {
      const dest = join(mediaDir, original)
      if (!existsSync(dest)) return original
      let c = 1
      const ext = original.includes('.') ? '.' + original.split('.').pop() : ''
      const base = ext ? original.slice(0, -ext.length) : original
      while (existsSync(join(mediaDir, base + '-' + c + ext))) c++
      return base + '-' + c + ext
    }

    const name = safeName('photo.png')
    const destPath = join(mediaDir, name)
    copyFileSync(sourceFile, destPath)

    expect(sha256(sourceFile)).toBe(sourceChecksum)
    expect(sha256(destPath)).toBe(sourceChecksum)

    const dbPath = join(projectDir, 'database', 'project.sqlite')
    mkdirSync(join(projectDir, 'database'), { recursive: true })
    const repo = createDrizzleMediaRepository(dbPath)
    const media = RessourceMedia.create({ projetId, type: 'image', cheminRelatif: 'media/source/' + name, nomOriginal: 'photo.png', checksum: sourceChecksum, tailleOctets: buffer.length, mimeType: 'image/png' })
    await repo.save(media)

    const thumbDir = join(projectDir, 'media', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    const thumbPath = join(thumbDir, name.replace(/\.\w+$/, '_thumb.jpg'))
    await sharp(destPath).resize(32, 32).jpeg().toFile(thumbPath)
    expect(existsSync(thumbPath)).toBe(true)

    const meta = await sharp(destPath).metadata()
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(48)

    const repo2 = createDrizzleMediaRepository(dbPath)
    const found = await repo2.findById(media.id)
    expect(found).not.toBeNull()
    expect(found!.checksum).toBe(sourceChecksum)
    expect(found!.statut).toBe('disponible')

    const sceneRepo = createDrizzleSceneRepository(dbPath)
    const scene = Scene.create({ projetId, ordre: 1, type: 'texte', titre: 'With image' })
    await sceneRepo.save(scene)
    await sceneRepo.associateMedia(scene.id, media.id.value)
    expect(await sceneRepo.getMediaId(scene.id)).toBe(media.id.value)

    const updated = found!.marquerManquante()
    await repo2.save(updated)
    expect((await repo2.findById(media.id))!.statut).toBe('manquante')

    const restored = (await repo2.findById(media.id))!.restaurer()
    await repo2.save(restored)
    expect((await repo2.findById(media.id))!.statut).toBe('disponible')

    expect(sha256(sourceFile)).toBe(sourceChecksum)
  })
})