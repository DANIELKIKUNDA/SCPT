import { describe, expect, it } from 'vitest'
import { PisteNarration } from '../piste-narration'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'

const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')

function generated(track: PisteNarration, text = 'Bonjour') {
  return track.addTake({
    texte: text,
    fichierAudio: 'audio/narration/test.wav',
    dureeMs: 1200,
    statut: 'generee',
    source: 'piper',
    voixId: 'fr_FR-siwis-medium',
    checksum: 'abc123'
  })
}

describe('PisteNarration', () => {
  it('creates a draft track', () => {
    const track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    expect(track.langue).toBe('fr')
    expect(track.statut).toBe('brouillon')
    expect(track.segments).toEqual([])
    expect(track.priseFinaleId).toBeNull()
  })

  it('adds a generated take with positive duration', () => {
    const track = generated(PisteNarration.create({ projetId: projectId, langue: 'fr' }))
    expect(track.segments).toHaveLength(1)
    expect(track.segments[0].dureeMs).toBe(1200)
    expect(track.statut).toBe('generee')
  })

  it('rejects invalid audio paths', () => {
    const track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    expect(() => track.addTake({
      texte: 'x',
      fichierAudio: 'audio\\bad.wav',
      dureeMs: 1,
      statut: 'generee',
      source: 'piper',
      checksum: 'abc'
    })).toThrow(/relative POSIX/)
  })

  it('selects a final take', () => {
    const track = generated(PisteNarration.create({ projetId: projectId, langue: 'fr' }))
    const takeId = track.segments[0].id
    const validated = track.selectFinalTake(takeId)
    expect(validated.priseFinaleId).toBe(takeId)
    expect(validated.statut).toBe('validee')
  })

  it('rejects an unknown final take', () => {
    const track = generated(PisteNarration.create({ projetId: projectId, langue: 'fr' }))
    expect(() => track.selectFinalTake('missing')).toThrow(/not found/)
  })

  it('increments text version when a regenerated take changes text', () => {
    const initial = generated(PisteNarration.create({ projetId: projectId, langue: 'fr' }), 'Version A')
    const same = generated(initial, 'Version A')
    expect(same.versionTexte.value).toBe(1)
    const changed = generated(same, 'Version B')
    expect(changed.versionTexte.value).toBe(2)
  })

  it('marks a generated track obsolete', () => {
    const track = generated(PisteNarration.create({ projetId: projectId, langue: 'fr' }))
    expect(track.markObsolete().statut).toBe('obsolete')
  })

  it('invalidates the previous final take when narration text changes', () => {
    let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    track = track.addTake({ texte: 'Version A', fichierAudio: 'audio/narration/a.wav', dureeMs: 1000, statut: 'generee', source: 'piper', checksum: 'a' })
    track = track.selectFinalTake(track.segments[0].id)
    track = track.addTake({ texte: 'Version B', fichierAudio: 'audio/narration/b.wav', dureeMs: 1100, statut: 'generee', source: 'piper', checksum: 'b' })
    expect(track.priseFinaleId).toBeNull()
    expect(track.statut).toBe('generee')
    expect(track.versionTexte.value).toBe(2)
  })

  it('keeps a valid final take while generating an alternative with the same text', () => {
    let track = PisteNarration.create({ projetId: projectId, langue: 'fr' })
    track = track.addTake({ texte: 'Même texte', fichierAudio: 'audio/narration/a.wav', dureeMs: 1000, statut: 'generee', source: 'piper', checksum: 'a' })
    const finalId = track.segments[0].id
    track = track.selectFinalTake(finalId)
    track = track.addTake({ texte: 'Même texte', fichierAudio: 'audio/narration/b.wav', dureeMs: 1200, statut: 'generee', source: 'piper', checksum: 'b' })
    expect(track.priseFinaleId).toBe(finalId)
    expect(track.statut).toBe('validee')
    expect(track.versionTexte.value).toBe(1)
  })

})
