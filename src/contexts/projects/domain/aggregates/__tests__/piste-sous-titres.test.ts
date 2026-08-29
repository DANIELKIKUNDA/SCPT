import { describe, expect, it } from 'vitest'
import { PisteSousTitres } from '../piste-sous-titres'
import { VersionMetier } from '../../value-objects/version-metier'

function synced() {
  return PisteSousTitres.create({ langue: 'fr', versionNarration: VersionMetier.initial() }).synchronize([
    { debutMs: 0, finMs: 1500, texte: 'Bonjour', position: 'bas' },
    { debutMs: 1500, finMs: 3200, texte: 'Deuxième segment', position: 'bas' }
  ], VersionMetier.initial())
}

describe('PisteSousTitres', () => {
  it('creates an empty draft track with canonical identifiers', () => {
    const track = PisteSousTitres.create({ langue: 'fr' })
    expect(track.langue).toBe('fr')
    expect(track.statut).toBe('brouillon')
    expect(track.segments).toEqual([])
    expect(track.id.value).toBeTruthy()
    expect(track.declinaisonId.value).toBeTruthy()
  })

  it('synchronizes ordered non-overlapping segments', () => {
    const track = synced()
    expect(track.segments.map((segment) => segment.ordre)).toEqual([1, 2])
    expect(track.segments[1].debutMs).toBe(track.segments[0].finMs)
  })

  it('rejects overlapping intervals', () => {
    const track = synced()
    expect(() => track.addSegment({
      debutMs: 1200,
      finMs: 1800,
      texte: 'Chevauchement',
      position: 'bas'
    })).toThrow('overlap')
  })

  it('rejects more than two subtitle lines', () => {
    const track = PisteSousTitres.create({ langue: 'fr' })
    expect(() => track.addSegment({
      debutMs: 0,
      finMs: 1000,
      texte: 'ligne 1\nligne 2\nligne 3',
      position: 'bas'
    })).toThrow('at most 2 lines')
  })

  it('edits timing, text and position while preserving invariants', () => {
    const track = synced()
    const id = track.segments[0].id
    const updated = track.updateSegment(id, {
      finMs: 1400,
      texte: 'Texte corrigé',
      position: 'haut'
    })
    expect(updated.segments[0]).toMatchObject({ finMs: 1400, texte: 'Texte corrigé', position: 'haut' })
  })

  it('deletes and reorders segments deterministically', () => {
    const track = synced()
    const updated = track.deleteSegment(track.segments[0].id)
    expect(updated.segments).toHaveLength(1)
    expect(updated.segments[0].ordre).toBe(1)
  })

  it('validates a synchronized non-empty track', () => {
    const track = synced().validateAgainst(VersionMetier.initial())
    expect(track.statut).toBe('validee')
  })

  it('returns a validated track to draft after editing', () => {
    const validated = synced().validateAgainst(VersionMetier.initial())
    const updated = validated.updateSegment(validated.segments[0].id, { texte: 'Nouvelle formulation' })
    expect(updated.statut).toBe('brouillon')
  })

  it('marks subtitles for resynchronization and blocks direct validation', () => {
    const stale = synced().validateAgainst(VersionMetier.initial()).markResyncNeeded()
    expect(stale.statut).toBe('a_resynchroniser')
    expect(() => stale.validateAgainst(VersionMetier.from(2))).toThrow('SUBTITLE_RESYNC_REQUIRED')
  })

  it('resynchronizes against the new narration version', () => {
    const stale = synced().markResyncNeeded()
    const refreshed = stale.synchronize([
      { debutMs: 0, finMs: 2000, texte: 'Version suivante', position: 'bas' }
    ], VersionMetier.from(2))
    expect(refreshed.statut).toBe('brouillon')
    expect(refreshed.versionNarration.value).toBe(2)
  })

  it('refuses validation when narration version changed even if stale status was not pre-marked', () => {
    const track = synced()
    expect(() => track.validateAgainst(VersionMetier.from(2))).toThrow('SUBTITLE_RESYNC_REQUIRED')
  })

  it('rejects unsafe subtitle font sizes', () => {
    const track = PisteSousTitres.create({ langue: 'fr' })
    expect(() => track.addSegment({
      debutMs: 0,
      finMs: 1000,
      texte: 'Test',
      position: 'bas',
      style: { fontSize: 200 }
    })).toThrow('font size')
  })
})
