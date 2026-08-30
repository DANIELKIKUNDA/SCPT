import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { InspectionMediaPort, MediaInspection } from '../../../application/ports/inspection-media.port'
import { DeclinaisonAudiovisuelle } from '../../../domain/aggregates/declinaison-audiovisuelle'
import { ExportAudiovisuel } from '../../../domain/aggregates/export-audiovisuel'
import { ExportFinalAudiovisuel } from '../../../domain/aggregates/export-final-audiovisuel'
import { PisteNarration } from '../../../domain/aggregates/piste-narration'
import type { DeclinaisonAudiovisuelleRepository } from '../../../domain/repositories/declinaison-audiovisuelle.repository'
import type { ExportAudiovisuelRepository } from '../../../domain/repositories/export-audiovisuel.repository'
import type { PisteNarrationRepository } from '../../../domain/repositories/piste-narration.repository'
import { DeclinaisonId } from '../../../domain/value-objects/declinaison-id'
import { FormatVideo } from '../../../domain/value-objects/format-video'
import { ProfilExport } from '../../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../../domain/value-objects/version-metier'
import { FinalExportInputBuilder } from '../final-export-input-builder'

const roots: string[] = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function fixture(options?: { videoWidth?: number; videoHeight?: number; audioDurationMs?: number }) {
  const root = mkdtempSync(join(tmpdir(), 'scpt-final-input-'))
  roots.push(root)
  const projectId = ProjetAudiovisuelId.from('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const sourceVersion = VersionMetier.from(3)
  const declinaisonId = DeclinaisonId.from('01ARZ3NDEKTSV4RRFFQ69G5FAW')
  let declinaison = DeclinaisonAudiovisuelle.create({
    id: declinaisonId, projetId: projectId, format: FormatVideo.horizontal(),
    langue: 'fr', versionProjetSource: sourceVersion
  })
  declinaison = declinaison.validate(sourceVersion, []).markReadyForRender(sourceVersion)

  const videoRelative = 'renders/previews/intermediate.mp4'
  const audioRelative = 'audio/narration/final.wav'
  mkdirSync(join(root, 'renders', 'previews'), { recursive: true })
  mkdirSync(join(root, 'audio', 'narration'), { recursive: true })
  writeFileSync(join(root, videoRelative), 'real-intermediate-bytes')
  writeFileSync(join(root, audioRelative), 'real-audio-bytes')
  const videoChecksum = sha('real-intermediate-bytes')
  const audioChecksum = sha('real-audio-bytes')

  const render = ExportAudiovisuel.request({
    projetId: projectId, declinaisonId, tentative: 1, profil: ProfilExport.mvpPremium(),
    versionsSources: { versionProjetSource: sourceVersion, versionDeclinaison: declinaison.version }
  }).enqueue().beginPreparation().beginComposition().beginVerification().complete({
    cheminFichier: videoRelative, checksum: videoChecksum
  })

  let narration = PisteNarration.create({ projetId: projectId, langue: 'fr' })
  narration = narration.addTake({
    texte: 'Narration finale', fichierAudio: audioRelative, dureeMs: options?.audioDurationMs ?? 3000,
    statut: 'generee', source: 'piper', voixId: 'fr_FR-siwis-medium', checksum: audioChecksum
  })
  narration = narration.selectFinalTake(narration.segments[0].id)

  const finalExport = ExportFinalAudiovisuel.request({
    projetId: projectId, renderJobId: render.id, declinaisonId, tentative: 1,
    profil: render.profil, sourceRenderChecksum: videoChecksum,
    narrationTakeId: narration.priseFinale!.id, narrationChecksum: audioChecksum
  }).enqueue()

  const renders: ExportAudiovisuelRepository = {
    save: async () => undefined,
    findById: async (id) => id.equals(render.id) ? render : null,
    findAllByProject: async () => [render],
    findActiveByDeclinaison: async () => null,
    findByStatuses: async () => [],
    maxAttemptForDeclinaison: async () => 1
  }
  const declinaisons: DeclinaisonAudiovisuelleRepository = {
    save: async () => undefined,
    findById: async (id) => id.equals(declinaison.id) ? declinaison : null,
    findAllByProject: async () => [declinaison],
    findCurrentBySignature: async () => declinaison
  }
  const narrations: PisteNarrationRepository = {
    save: async () => undefined,
    findById: async () => narration,
    findByProject: async () => narration
  }
  const videoInspection: MediaInspection = {
    formatName: 'mov,mp4', durationMs: 3000,
    streams: [{
      codecType: 'video', codecName: 'h264', width: options?.videoWidth ?? 1920,
      height: options?.videoHeight ?? 1080, pixelFormat: 'yuv420p', fps: 30,
      sampleRate: null, durationMs: 3000
    }]
  }
  const audioInspection: MediaInspection = {
    formatName: 'wav', durationMs: options?.audioDurationMs ?? 3000,
    streams: [{
      codecType: 'audio', codecName: 'pcm_s16le', width: null, height: null,
      pixelFormat: null, fps: null, sampleRate: 22050, durationMs: options?.audioDurationMs ?? 3000
    }]
  }
  const inspector: InspectionMediaPort = {
    inspect: async (filePath) => filePath.endsWith('.wav') ? audioInspection : videoInspection
  }
  const builder = new FinalExportInputBuilder(
    root, renders, declinaisons, narrations, { current: async () => sourceVersion }, inspector
  )
  return { root, builder, finalExport, narration, render, videoChecksum, audioChecksum }
}

describe('FinalExportInputBuilder', () => {
  it('builds immutable local inputs from a completed Phase 9 render and final narration', async () => {
    const f = fixture()
    const input = await f.builder.build(f.finalExport)
    expect(input.videoInputPath).toContain('renders')
    expect(input.audioInputPath).toContain('audio')
    expect(input.expectedDurationMs).toBe(3000)
    expect(input.width).toBe(1920)
    expect(input.height).toBe(1080)
    expect(input.formatLabel).toBe('16x9')
  })

  it('rejects a source render checksum mismatch', async () => {
    const f = fixture()
    const changed = ExportFinalAudiovisuel.request({
      projetId: f.finalExport.projetId, renderJobId: f.finalExport.renderJobId,
      declinaisonId: f.finalExport.declinaisonId, tentative: 1, profil: f.finalExport.profil,
      sourceRenderChecksum: 'f'.repeat(64), narrationTakeId: f.finalExport.narrationTakeId,
      narrationChecksum: f.finalExport.narrationChecksum
    }).enqueue()
    await expect(f.builder.build(changed)).rejects.toThrow('FINAL_EXPORT_RENDER_CHANGED')
  })

  it('detects a physically mutated input before encoding', async () => {
    const f = fixture()
    writeFileSync(join(f.root, 'renders', 'previews', 'intermediate.mp4'), 'tampered')
    await expect(f.builder.build(f.finalExport)).rejects.toThrow('FINAL_EXPORT_SOURCE_CHECKSUM_MISMATCH')
  })

  it('rejects a source resolution inconsistent with the declination', async () => {
    const f = fixture({ videoWidth: 1280 })
    await expect(f.builder.build(f.finalExport)).rejects.toThrow('FINAL_EXPORT_SOURCE_RESOLUTION_MISMATCH')
  })

  it('rejects a significant audio/video duration mismatch', async () => {
    const f = fixture({ audioDurationMs: 6000 })
    await expect(f.builder.build(f.finalExport)).rejects.toThrow('FINAL_EXPORT_DURATION_MISMATCH')
  })
})
