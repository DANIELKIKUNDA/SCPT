import { describe, expect, it } from 'vitest'
import { DeclinaisonAudiovisuelle } from '../declinaison-audiovisuelle'
import { FormatVideo } from '../../value-objects/format-video'
import { ProjetAudiovisuelId } from '../../value-objects/projet-audiovisuel-id'
import { ResolutionVideo } from '../../value-objects/resolution-video'
import { VersionMetier } from '../../value-objects/version-metier'

const projectId = ProjetAudiovisuelId.from('01J00000000000000000000000')

function create(format = FormatVideo.horizontal()) {
  return DeclinaisonAudiovisuelle.create({
    projetId: projectId,
    format,
    langue: 'fr',
    versionProjetSource: VersionMetier.from(3)
  })
}

describe('DeclinaisonAudiovisuelle', () => {
  it('creates a draft with canonical resolution and source version', () => {
    const value = create(FormatVideo.vertical())
    expect(value.statut).toBe('brouillon')
    expect(value.resolution.value).toEqual({ width: 1080, height: 1920 })
    expect(value.versionProjetSource.value).toBe(3)
  })

  it('rejects a resolution incompatible with the format', () => {
    expect(() => DeclinaisonAudiovisuelle.create({
      projetId: projectId,
      format: FormatVideo.vertical(),
      resolution: ResolutionVideo.from(1920, 1080),
      langue: 'fr',
      versionProjetSource: VersionMetier.initial()
    })).toThrow('incompatible')
  })

  it('stores a per-format scene override without changing the source scene', () => {
    const updated = create().setSceneOverride({ sceneId: 'scene-1', layout: 'top', backgroundColor: '#101828' })
    expect(updated.statut).toBe('adaptation_en_cours')
    expect(updated.getOverride('scene-1')).toEqual({ sceneId: 'scene-1', layout: 'top', backgroundColor: '#101828' })
    expect(updated.version.value).toBe(2)
  })

  it('replaces a scene override instead of duplicating it', () => {
    const once = create().setSceneOverride({ sceneId: 'scene-1', layout: 'top' })
    const twice = once.setSceneOverride({ sceneId: 'scene-1', layout: 'centered' })
    expect(twice.overrides).toHaveLength(1)
    expect(twice.overrides[0].layout).toBe('centered')
  })

  it('removes a scene override', () => {
    const updated = create().setSceneOverride({ sceneId: 'scene-1', layout: 'top' }).removeSceneOverride('scene-1')
    expect(updated.overrides).toEqual([])
  })

  it('validates only against the exact project source version', () => {
    const value = create()
    expect(() => value.validate(VersionMetier.from(4), [])).toThrow('DECLINATION_SOURCE_OBSOLETE')
    expect(value.validate(VersionMetier.from(3), []).statut).toBe('valide')
  })

  it('rejects overrides that reference a scene no longer present', () => {
    const value = create().setSceneOverride({ sceneId: 'scene-deleted', layout: 'centered' })
    expect(() => value.validate(VersionMetier.from(3), ['scene-1'])).toThrow('DECLINATION_UNKNOWN_SCENE')
  })

  it('marks itself obsolete when the source project changes', () => {
    const value = create().markObsoleteIfSourceChanged(VersionMetier.from(4))
    expect(value.statut).toBe('obsolete')
    expect(value.isObsolete).toBe(true)
  })

  it('does not revive an obsolete declination when asked to adapt it', () => {
    const value = create().markObsolete()
    expect(() => value.setSceneOverride({ sceneId: 'scene-1', layout: 'top' })).toThrow('immutable')
  })

  it('requires validation before render readiness', () => {
    const value = create()
    expect(() => value.markReadyForRender(VersionMetier.from(3))).toThrow('validated')
    const ready = value.validate(VersionMetier.from(3), []).markReadyForRender(VersionMetier.from(3))
    expect(ready.statut).toBe('pret_pour_rendu')
  })

  it('freezes a render-ready declination against visual overrides', () => {
    const ready = create().validate(VersionMetier.from(3), []).markReadyForRender(VersionMetier.from(3))
    expect(() => ready.setSceneOverride({ sceneId: 'scene-1', layout: 'top' })).toThrow('frozen')
  })
})
