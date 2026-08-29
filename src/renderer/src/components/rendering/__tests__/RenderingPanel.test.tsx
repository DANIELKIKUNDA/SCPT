import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeclinaisonDto, ElectronAPI, ProjectDto, RenderJobDto } from '../../../../../shared/types/electron-api'
import { RenderingPanel } from '../RenderingPanel'

const project: ProjectDto = {
  id: '01J00000000000000000000000',
  titre: 'Logarithmes',
  type: 'cours',
  objectif: 'Expliquer',
  publicCible: 'Élèves',
  langueSource: 'fr',
  statut: 'brouillon',
  version: 1,
  createdAt: '2026-08-29T08:00:00.000Z',
  updatedAt: '2026-08-29T08:00:00.000Z',
  isArchived: false
}

const declination: DeclinaisonDto = {
  id: 'decl-1',
  projectId: project.id,
  format: 'HORIZONTAL_16_9',
  resolution: { width: 1920, height: 1080 },
  langue: 'fr',
  profilExport: 'MVP_PREMIUM',
  statut: 'pret_pour_rendu',
  versionProjetSource: 1,
  versionSourceCourante: 1,
  version: 3,
  obsolete: false,
  pretPourRendu: true,
  safeZone: { left: 64, right: 64, top: 48, bottom: 48 },
  overrides: []
}

function job(status: RenderJobDto['statut'] = 'en_attente'): RenderJobDto {
  return {
    id: 'job-1',
    projectId: project.id,
    declinaisonId: declination.id,
    tentative: 1,
    statut: status,
    progression: status === 'termine' ? 100 : 15,
    cheminFichier: status === 'termine' ? 'renders/previews/16x9-job-1-a1.mp4' : null,
    checksum: status === 'termine' ? 'a'.repeat(64) : null,
    diagnostic: null,
    profil: 'MVP_PREMIUM',
    versionProjetSource: 1,
    versionDeclinaisonSource: 3,
    createdAt: '2026-08-29T08:00:00.000Z',
    updatedAt: '2026-08-29T08:00:01.000Z',
    startedAt: null,
    finishedAt: status === 'termine' ? '2026-08-29T08:00:02.000Z' : null,
    actif: !['termine', 'echoue', 'annule'].includes(status),
    peutRelancer: ['echoue', 'annule'].includes(status),
    logRelativePath: 'logs/render-job-1.jsonl'
  }
}

function installApi(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const api = {
    renderList: vi.fn(async () => ({ ok: true as const, data: [] })),
    renderStart: vi.fn(async () => ({ ok: true as const, data: job() })),
    renderCancel: vi.fn(async () => ({ ok: true as const, data: { canceled: true } })),
    renderRetry: vi.fn(async () => ({ ok: true as const, data: job() })),
    renderReadLog: vi.fn(async () => ({ ok: true as const, data: { content: '' } })),
    ...overrides
  } as unknown as ElectronAPI
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api })
  return api
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'electronAPI')
})

describe('RenderingPanel', () => {
  it('shows a ready declination and starts a real queued render through typed IPC', async () => {
    const api = installApi()
    render(<RenderingPanel project={project} declinaisons={[declination]} />)
    const button = await screen.findByRole('button', { name: /lancer le rendu/i })
    fireEvent.click(button)
    await waitFor(() => expect(api.renderStart).toHaveBeenCalledWith({ projectId: project.id, declinaisonId: declination.id }))
    expect(await screen.findByText(/ajouté à la file/i)).toBeTruthy()
  })

  it('renders persisted completion metadata and relative output without exposing a machine path', async () => {
    installApi({ renderList: vi.fn(async () => ({ ok: true as const, data: [job('termine')] })) })
    render(<RenderingPanel project={project} declinaisons={[declination]} />)
    expect(await screen.findByText(/Terminé ·/)).toBeTruthy()
    expect(screen.getByText('renders/previews/16x9-job-1-a1.mp4')).toBeTruthy()
    expect(screen.queryByText(/C:\\/)).toBeNull()
  })
})
