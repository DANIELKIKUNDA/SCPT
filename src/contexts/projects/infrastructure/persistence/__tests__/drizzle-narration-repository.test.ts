import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDrizzleNarrationRepository } from '../drizzle-narration-repository'
import { PisteNarration } from '../../../domain/aggregates/piste-narration'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')

describe('DrizzleNarrationRepository', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scpt-narration-repo-'))
    dbPath = join(dir, 'project.sqlite')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('persists and restores a narration track with takes', async () => {
    const repo = createDrizzleNarrationRepository(dbPath)
    let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    track = track.addTake({
      texte: 'Bonjour',
      fichierAudio: 'audio/narration/take.wav',
      dureeMs: 2400,
      statut: 'generee',
      source: 'piper',
      voixId: 'fr_FR-siwis-medium',
      checksum: 'checksum-one'
    })
    track = track.selectFinalTake(track.segments[0].id)
    await repo.save(track)
    repo.close()

    const reopened = createDrizzleNarrationRepository(dbPath)
    const restored = await reopened.findByProject(projectId)
    expect(restored).not.toBeNull()
    expect(restored!.segments).toHaveLength(1)
    expect(restored!.segments[0].dureeMs).toBe(2400)
    expect(restored!.priseFinaleId).toBe(restored!.segments[0].id)
    expect(restored!.statut).toBe('validee')
    reopened.close()
  })

  it('replaces the selected final take after regeneration', async () => {
    const repo = createDrizzleNarrationRepository(dbPath)
    let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    track = track.addTake({ texte: 'A', fichierAudio: 'audio/narration/a.wav', dureeMs: 1000, statut: 'generee', source: 'piper', checksum: 'a' })
    track = track.selectFinalTake(track.segments[0].id)
    track = track.addTake({ texte: 'B', fichierAudio: 'audio/narration/b.wav', dureeMs: 1800, statut: 'generee', source: 'piper', checksum: 'b' })
    track = track.selectFinalTake(track.segments[1].id)
    await repo.save(track)

    const restored = await repo.findByProject(projectId)
    expect(restored!.priseFinale?.fichierAudio).toBe('audio/narration/b.wav')
    expect(restored!.priseFinale?.dureeMs).toBe(1800)
    repo.close()
  })
})
