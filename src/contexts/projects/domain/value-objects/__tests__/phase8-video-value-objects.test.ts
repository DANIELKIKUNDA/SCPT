import { describe, expect, it } from 'vitest'
import { FormatVideo } from '../format-video'
import { ResolutionVideo } from '../resolution-video'
import { ProfilExport } from '../profil-export'

describe('Phase 8 video value objects', () => {
  it('accepts the three canonical formats', () => {
    expect(FormatVideo.horizontal().label).toBe('16:9')
    expect(FormatVideo.vertical().label).toBe('9:16')
    expect(FormatVideo.square().label).toBe('1:1')
  })

  it('rejects an unsupported format', () => {
    expect(() => FormatVideo.from('4:3')).toThrow('Invalid FormatVideo')
  })

  it('maps canonical Full-HD/mobile resolutions', () => {
    expect(ResolutionVideo.canonicalFor(FormatVideo.horizontal()).value).toEqual({ width: 1920, height: 1080 })
    expect(ResolutionVideo.canonicalFor(FormatVideo.vertical()).value).toEqual({ width: 1080, height: 1920 })
    expect(ResolutionVideo.canonicalFor(FormatVideo.square()).value).toEqual({ width: 1080, height: 1080 })
  })

  it('rejects a resolution with the wrong aspect ratio', () => {
    const resolution = ResolutionVideo.from(1920, 1080)
    expect(() => resolution.assertCompatibleWith(FormatVideo.vertical())).toThrow('incompatible')
  })

  it('rejects invalid resolution dimensions', () => {
    expect(() => ResolutionVideo.from(0, 1080)).toThrow('Invalid ResolutionVideo')
    expect(() => ResolutionVideo.from(1080.5, 1080)).toThrow('Invalid ResolutionVideo')
  })

  it('locks the Phase 8 export profile to MVP Premium without implementing encoding', () => {
    expect(ProfilExport.mvpPremium().value).toBe('MVP_PREMIUM')
    expect(() => ProfilExport.from('H264_CUSTOM')).toThrow('Invalid ProfilExport')
  })
})
