import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ElectronAPI, ProjectDto, ReliabilityOverviewDto } from '../../../../../shared/types/electron-api'
import { ReliabilityPanel } from '../ReliabilityPanel'

const project: ProjectDto = {
  id: '01J00000000000000000000000', titre: 'Logarithmes', type: 'cours', objectif: 'Expliquer',
  publicCible: 'Élèves', langueSource: 'fr', statut: 'brouillon', version: 1,
  createdAt: '2026-08-30T08:00:00.000Z', updatedAt: '2026-08-30T08:00:00.000Z', isArchived: false
}

function overview(overrides: Partial<ReliabilityOverviewDto> = {}): ReliabilityOverviewDto {
  return {
    audit: {
      id: 'audit-1', projectId: project.id, status: 'attention',
      anomalies: [{ code: 'NO_RECOVERY_SNAPSHOT', severity: 'warning', message: 'Aucun point de récupération', detail: null }],
      checklist: [{ id: 'backup', label: 'Point de récupération', status: 'warning', detail: 'Aucun snapshot' }],
      createdAt: '2026-08-30T08:00:00.000Z'
    },
    backups: [{
      id: 'backup-1', kind: 'manual', createdAt: '2026-08-30T08:01:00.000Z', appVersion: '1.0.0',
      projectFormatVersion: 2, databaseSchemaVersion: 1, fileCount: 8, totalBytes: 2048,
      sourceFingerprint: 'a'.repeat(64)
    }],
    tasks: [{
      id: 'render-old', kind: 'render', projectId: project.id, targetId: 'd1', status: 'termine', progress: 100,
      attempt: 1, diagnostic: null, createdAt: '2026-08-30T07:00:00.000Z', updatedAt: '2026-08-30T07:01:00.000Z',
      finishedAt: '2026-08-30T07:01:00.000Z', active: false, obsolete: true
    }],
    recentAudits: [], crashRecovered: false,
    versions: { formatVersion: 2, databaseSchemaVersion: 1, appVersion: '1.0.0' },
    ...overrides
  }
}

function installApi(value = overview(), overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const api = {
    reliabilityOverview: vi.fn(async () => ({ ok: true as const, data: value })),
    reliabilityRunAudit: vi.fn(async () => ({ ok: true as const, data: { ...value, audit: { ...value.audit, status: 'healthy' as const, anomalies: [] } } })),
    reliabilityCreateBackup: vi.fn(async () => ({ ok: true as const, data: value.backups[0] })),
    reliabilityRestoreBackup: vi.fn(async () => ({ ok: true as const, data: { restored: true as const, backupId: 'backup-1', safetyBackupId: 'safety-1', requiresReopen: true as const } })),
    reliabilityCleanTemp: vi.fn(async () => ({ ok: true as const, data: { removedEntries: 2, removedBytes: 2048, skippedActive: 0 } })),
    ...overrides
  } as unknown as ElectronAPI
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api })
  return api
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'electronAPI')
})

describe('ReliabilityPanel', () => {
  it('shows audit checklist, anomalies, recovery points and historical task obsolescence', async () => {
    installApi()
    render(<ReliabilityPanel project={project} onRestored={async () => undefined} />)
    expect(await screen.findByText('Attention requise')).toBeTruthy()
    expect(screen.getByText('Aucun point de récupération')).toBeTruthy()
    expect(screen.getByText('Manuelle')).toBeTruthy()
    expect(screen.getByText('Historique')).toBeTruthy()
  })

  it('runs audit and disposable cleanup only through typed preload IPC', async () => {
    const api = installApi()
    render(<ReliabilityPanel project={project} onRestored={async () => undefined} />)
    await screen.findByText('Attention requise')
    fireEvent.click(screen.getByRole('button', { name: /lancer un audit/i }))
    await waitFor(() => expect(api.reliabilityRunAudit).toHaveBeenCalledWith(project.id))
    fireEvent.click(screen.getByRole('button', { name: /nettoyer les temporaires/i }))
    await waitFor(() => expect(api.reliabilityCleanTemp).toHaveBeenCalledWith(project.id))
  })

  it('requires explicit confirmation before restoration and closes the project after success', async () => {
    const api = installApi()
    const onRestored = vi.fn(async () => undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ReliabilityPanel project={project} onRestored={onRestored} />)
    const restore = await screen.findByRole('button', { name: /restaurer/i })
    fireEvent.click(restore)
    await waitFor(() => expect(api.reliabilityRestoreBackup).toHaveBeenCalledWith({ projectId: project.id, backupId: 'backup-1' }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1))
  })

  it('disables destructive cleanup and restore actions while a task is active', async () => {
    const value = overview({
      tasks: [{
        id: 'active', kind: 'final_export', projectId: project.id, targetId: 'r1', status: 'en_encodage', progress: 50,
        attempt: 1, diagnostic: null, createdAt: '2026-08-30T08:00:00Z', updatedAt: '2026-08-30T08:00:01Z',
        finishedAt: null, active: true, obsolete: false
      }]
    })
    installApi(value)
    render(<ReliabilityPanel project={project} onRestored={async () => undefined} />)
    const cleanup = await screen.findByRole('button', { name: /nettoyer les temporaires/i })
    const restore = screen.getByRole('button', { name: /restaurer/i })
    expect(cleanup).toBeDisabled()
    expect(restore).toBeDisabled()
  })
})
