import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeclinaisonDto, ElectronAPI, FinalExportDto, ProjectDto, RenderJobDto } from '../../../../../shared/types/electron-api'
import { FinalExportPanel } from '../FinalExportPanel'

const project: ProjectDto = {
  id: '01J00000000000000000000000', titre: 'Logarithmes', type: 'cours', objectif: 'Expliquer',
  publicCible: 'Élèves', langueSource: 'fr', statut: 'brouillon', version: 1,
  createdAt: '2026-08-29T08:00:00.000Z', updatedAt: '2026-08-29T08:00:00.000Z', isArchived: false
}

const declination: DeclinaisonDto = {
  id: 'decl-1', projectId: project.id, format: 'HORIZONTAL_16_9', resolution: { width: 1920, height: 1080 },
  langue: 'fr', profilExport: 'MVP_PREMIUM', statut: 'pret_pour_rendu', versionProjetSource: 1,
  versionSourceCourante: 1, version: 3, obsolete: false, pretPourRendu: true,
  safeZone: { left: 64, right: 64, top: 48, bottom: 48 }, overrides: []
}

const renderJob: RenderJobDto = {
  id: 'render-1', projectId: project.id, declinaisonId: declination.id, tentative: 1, statut: 'termine', progression: 100,
  cheminFichier: 'renders/previews/source.mp4', checksum: 'a'.repeat(64), diagnostic: null, profil: 'MVP_PREMIUM',
  versionProjetSource: 1, versionDeclinaisonSource: 3, createdAt: '2026-08-29T08:00:00.000Z',
  updatedAt: '2026-08-29T08:00:03.000Z', startedAt: '2026-08-29T08:00:00.000Z',
  finishedAt: '2026-08-29T08:00:03.000Z', actif: false, peutRelancer: false, logRelativePath: 'logs/render-1.jsonl'
}

function finalExport(status: FinalExportDto['statut'] = 'termine'): FinalExportDto {
  return {
    id: 'final-1', projectId: project.id, renderJobId: renderJob.id, declinaisonId: declination.id,
    tentative: 1, statut: status, progression: status === 'termine' ? 100 : 55, profil: 'MVP_PREMIUM',
    sourceRenderChecksum: 'a'.repeat(64), narrationTakeId: 'take-1', narrationChecksum: 'b'.repeat(64), diagnostic: null,
    technique: status === 'termine' ? {
      nomFichier: 'Logarithmes_16x9_final.mp4', cheminFichier: 'renders/final/Logarithmes_16x9_final.mp4',
      checksum: 'c'.repeat(64), tailleOctets: 2048, dureeMs: 3000, largeur: 1920, hauteur: 1080, fps: 30,
      codecVideo: 'h264', pixelFormat: 'yuv420p', codecAudio: 'aac', audioSampleRate: 48000
    } : null,
    createdAt: '2026-08-29T08:00:00.000Z', updatedAt: '2026-08-29T08:00:03.000Z',
    startedAt: '2026-08-29T08:00:00.000Z', finishedAt: status === 'termine' ? '2026-08-29T08:00:03.000Z' : null,
    actif: !['termine', 'echoue', 'annule'].includes(status), peutRelancer: ['echoue', 'annule'].includes(status),
    logRelativePath: 'logs/final-export-final-1.jsonl'
  }
}

function installApi(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const api = {
    renderList: vi.fn(async () => ({ ok: true as const, data: [renderJob] })),
    finalExportList: vi.fn(async () => ({ ok: true as const, data: [] })),
    finalExportStart: vi.fn(async () => ({ ok: true as const, data: finalExport('en_attente') })),
    finalExportCancel: vi.fn(async () => ({ ok: true as const, data: { canceled: true } })),
    finalExportRetry: vi.fn(async () => ({ ok: true as const, data: finalExport('en_attente') })),
    finalExportReadLog: vi.fn(async () => ({ ok: true as const, data: { content: '{"event":"completed"}' } })),
    finalExportOpenFile: vi.fn(async () => ({ ok: true as const, data: { opened: true } })),
    finalExportShowInFolder: vi.fn(async () => ({ ok: true as const, data: { shown: true } })),
    ...overrides
  } as unknown as ElectronAPI
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api })
  return api
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'electronAPI')
})

describe('FinalExportPanel', () => {
  it('lists a completed Phase 9 render and requests the final MP4 through typed IPC', async () => {
    const api = installApi()
    render(<FinalExportPanel project={project} declinaisons={[declination]} />)
    const button = await screen.findByRole('button', { name: /créer le mp4 final/i })
    expect(screen.getByText(/16:9 · tentative 1/)).toBeTruthy()
    fireEvent.click(button)
    await waitFor(() => expect(api.finalExportStart).toHaveBeenCalledWith({ projectId: project.id, renderJobId: renderJob.id }))
  })

  it('shows objective verified technical metadata for a completed final export', async () => {
    installApi({ finalExportList: vi.fn(async () => ({ ok: true as const, data: [finalExport()] })) })
    render(<FinalExportPanel project={project} declinaisons={[declination]} />)
    expect(await screen.findByText('Logarithmes_16x9_final.mp4')).toBeTruthy()
    expect(screen.getByText('1920×1080')).toBeTruthy()
    expect(screen.getByText('H264 / AAC')).toBeTruthy()
    expect(screen.getByText('48 kHz')).toBeTruthy()
    expect(screen.getByText(/SHA-256 cccccccccccccccc/)).toBeTruthy()
  })

  it('opens the verified file through Electron instead of exposing a shell command', async () => {
    const api = installApi({ finalExportList: vi.fn(async () => ({ ok: true as const, data: [finalExport()] })) })
    render(<FinalExportPanel project={project} declinaisons={[declination]} />)
    const button = await screen.findByRole('button', { name: /lire/i })
    fireEvent.click(button)
    await waitFor(() => expect(api.finalExportOpenFile).toHaveBeenCalledWith({ projectId: project.id, exportId: 'final-1' }))
  })
})
