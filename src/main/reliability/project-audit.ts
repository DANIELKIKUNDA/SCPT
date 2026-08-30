import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AuditAnomalyRecord,
  AuditChecklistRecord,
  AuditEntryRecord,
  ReliabilityRepository
} from '../../contexts/projects/application/ports/reliability-repository.port'
import type { ProjectManifestData } from '../persistence/project-manifest'
import { DATABASE_SCHEMA_VERSION, MANIFEST_FORMAT_VERSION } from '../persistence/project-manifest'
import { ProjectBackupService, sha256File } from './project-backup'
import { ProjectTempCleaner } from './temp-cleaner'

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
}

function checklistStatus(anomalies: AuditAnomalyRecord[], codes: string[]): AuditChecklistRecord['status'] {
  const relevant = anomalies.filter((item) => codes.includes(item.code))
  if (relevant.some((item) => item.severity === 'blocking')) return 'blocked'
  if (relevant.length > 0) return 'warning'
  return 'ok'
}

export class ProjectAuditService {
  constructor(
    private readonly projectDir: string,
    private readonly repository: ReliabilityRepository
  ) {}

  async run(input: {
    projectId: string
    manifest: ProjectManifestData
    crashDetected: boolean
  }): Promise<AuditEntryRecord> {
    const anomalies: AuditAnomalyRecord[] = []
    const add = (code: string, severity: AuditAnomalyRecord['severity'], message: string, detail: string | null = null): void => {
      anomalies.push({ code, severity, message, detail })
    }

    if (input.manifest.formatVersion !== MANIFEST_FORMAT_VERSION) {
      add('PROJECT_FORMAT_OUTDATED', 'warning', 'Le manifeste du projet doit être migré.', `v${input.manifest.formatVersion} → v${MANIFEST_FORMAT_VERSION}`)
    }
    if (input.manifest.databaseSchemaVersion !== DATABASE_SCHEMA_VERSION) {
      add('DATABASE_SCHEMA_OUTDATED', 'warning', 'Le schéma de récupération doit être migré.', `v${input.manifest.databaseSchemaVersion} → v${DATABASE_SCHEMA_VERSION}`)
    }
    if (input.crashDetected) {
      add('UNCLEAN_PREVIOUS_SESSION', 'warning', 'Une fermeture brutale précédente a été détectée.', 'Les tâches et temporaires ont été réconciliés au redémarrage.')
    }

    const requiredDirs = [
      'database', 'media/source', 'audio/narration', 'audio/temp', 'subtitles',
      'renders/previews', 'renders/final', 'logs', 'backups', 'recovery',
      'temp/rendering', 'temp/exporting', 'temp/restoring'
    ]
    for (const relativePath of requiredDirs) {
      if (!existsSync(join(this.projectDir, ...relativePath.split('/')))) {
        add('PROJECT_DIRECTORY_MISSING', 'blocking', 'Un dossier obligatoire du projet est absent.', relativePath)
      }
    }

    const dbPath = join(this.projectDir, 'database', 'project.sqlite')
    if (!existsSync(dbPath)) {
      add('DATABASE_MISSING', 'blocking', 'La base SQLite du projet est absente.')
    } else {
      let db: Database.Database | null = null
      try {
        db = new Database(dbPath, { readonly: true, fileMustExist: true })
        const integrity = db.pragma('integrity_check', { simple: true }) as string
        if (integrity !== 'ok') add('DATABASE_INTEGRITY_FAILED', 'blocking', 'SQLite signale une base incohérente.', integrity)

        if (tableExists(db, 'ressources_media')) {
          const medias = db.prepare(`
            SELECT chemin_relatif, checksum, statut FROM ressources_media WHERE projet_id = ?
          `).all(input.projectId) as Array<{ chemin_relatif: string; checksum: string; statut: string }>
          for (const media of medias) {
            const full = join(this.projectDir, ...media.chemin_relatif.split('/'))
            if (!existsSync(full)) {
              add('MEDIA_FILE_MISSING', 'blocking', 'Un média référencé est absent.', media.chemin_relatif)
            } else if (media.statut !== 'manquante') {
              const checksum = await sha256File(full)
              if (checksum !== media.checksum) {
                add('MEDIA_CHECKSUM_MISMATCH', 'blocking', 'Un média a été modifié hors de SCPT.', media.chemin_relatif)
              }
            }
          }
        }

        if (tableExists(db, 'render_jobs')) {
          const rows = db.prepare(`
            SELECT id, statut, chemin_fichier, checksum FROM render_jobs WHERE project_id = ?
          `).all(input.projectId) as Array<{ id: string; statut: string; chemin_fichier: string | null; checksum: string | null }>
          for (const row of rows) {
            if (['demande', 'en_attente', 'en_preparation', 'en_composition', 'en_encodage', 'en_verification'].includes(row.statut)) {
              add('RENDER_JOB_INTERRUPTED', 'warning', 'Une tâche de rendu nécessite une reprise.', row.id)
            }
            if (row.statut === 'termine' && row.chemin_fichier && row.checksum) {
              const full = join(this.projectDir, ...row.chemin_fichier.split('/'))
              if (!existsSync(full)) add('RENDER_OUTPUT_MISSING', 'warning', 'Un rendu historique est absent.', row.chemin_fichier)
              else if (await sha256File(full) !== row.checksum) add('RENDER_OUTPUT_CORRUPTED', 'blocking', 'Un rendu historique a été modifié.', row.chemin_fichier)
            }
          }
        }

        if (tableExists(db, 'final_exports')) {
          const rows = db.prepare(`
            SELECT id, statut, chemin_fichier, checksum FROM final_exports WHERE project_id = ?
          `).all(input.projectId) as Array<{ id: string; statut: string; chemin_fichier: string | null; checksum: string | null }>
          for (const row of rows) {
            if (['demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification'].includes(row.statut)) {
              add('FINAL_EXPORT_INTERRUPTED', 'warning', 'Un export final nécessite une reprise.', row.id)
            }
            if (row.statut === 'termine' && row.chemin_fichier && row.checksum) {
              const full = join(this.projectDir, ...row.chemin_fichier.split('/'))
              if (!existsSync(full)) add('FINAL_EXPORT_MISSING', 'blocking', 'Un export final immuable est absent.', row.chemin_fichier)
              else if (await sha256File(full) !== row.checksum) add('FINAL_EXPORT_CORRUPTED', 'blocking', 'Un export final immuable a été modifié.', row.chemin_fichier)
            }
          }
        }

        if (tableExists(db, 'declinaisons') && tableExists(db, 'project_source_state')) {
          const source = db.prepare('SELECT version FROM project_source_state LIMIT 1').get() as { version?: number } | undefined
          const currentVersion = typeof source?.version === 'number' ? source.version : 1
          const obsoleteCount = (db.prepare(`
            SELECT COUNT(*) AS count FROM declinaisons WHERE project_id = ? AND version_project_source < ?
          `).get(input.projectId, currentVersion) as { count: number }).count
          if (obsoleteCount > 0) add('OBSOLETE_DECLINAISONS_PRESENT', 'info', 'Des déclinaisons historiques sont obsolètes mais conservées.', String(obsoleteCount))
        }
      } catch (error) {
        add('DATABASE_AUDIT_FAILED', 'blocking', 'L’audit SQLite n’a pas pu être exécuté.', error instanceof Error ? error.message : String(error))
      } finally {
        db?.close()
      }
    }

    const tempInfo = await new ProjectTempCleaner(this.projectDir).inspect()
    if (tempInfo.entries > 0) {
      add('TEMPORARY_FILES_PRESENT', 'warning', 'Des fichiers temporaires abandonnés peuvent être nettoyés.', `${tempInfo.entries} élément(s), ${tempInfo.bytes} octets`)
    }

    const backupService = new ProjectBackupService(this.projectDir)
    const backups = await backupService.list()
    if (backups.length === 0) add('NO_RECOVERY_SNAPSHOT', 'warning', 'Aucun point de récupération n’est encore disponible.')

    const checklist: AuditChecklistRecord[] = [
      {
        id: 'version', label: 'Version du projet',
        status: checklistStatus(anomalies, ['PROJECT_FORMAT_OUTDATED', 'DATABASE_SCHEMA_OUTDATED']),
        detail: `Format ${input.manifest.formatVersion}, schéma ${input.manifest.databaseSchemaVersion}`
      },
      {
        id: 'database', label: 'Intégrité SQLite',
        status: checklistStatus(anomalies, ['DATABASE_MISSING', 'DATABASE_INTEGRITY_FAILED', 'DATABASE_AUDIT_FAILED']),
        detail: 'Base structurée lisible et cohérente'
      },
      {
        id: 'media', label: 'Médias sources',
        status: checklistStatus(anomalies, ['MEDIA_FILE_MISSING', 'MEDIA_CHECKSUM_MISMATCH']),
        detail: 'Présence et checksum des médias référencés'
      },
      {
        id: 'outputs', label: 'Rendus et exports',
        status: checklistStatus(anomalies, ['RENDER_OUTPUT_MISSING', 'RENDER_OUTPUT_CORRUPTED', 'FINAL_EXPORT_MISSING', 'FINAL_EXPORT_CORRUPTED']),
        detail: 'Exports réussis conservés et immuables'
      },
      {
        id: 'tasks', label: 'Tâches',
        status: checklistStatus(anomalies, ['RENDER_JOB_INTERRUPTED', 'FINAL_EXPORT_INTERRUPTED', 'UNCLEAN_PREVIOUS_SESSION']),
        detail: 'Aucune tâche incohérente après reprise'
      },
      {
        id: 'temporary', label: 'Temporaires',
        status: checklistStatus(anomalies, ['TEMPORARY_FILES_PRESENT']),
        detail: `${tempInfo.entries} élément(s) temporaire(s)`
      },
      {
        id: 'backup', label: 'Point de récupération',
        status: checklistStatus(anomalies, ['NO_RECOVERY_SNAPSHOT']),
        detail: backups[0] ? `Dernier : ${backups[0].createdAt}` : 'Aucun snapshot'
      }
    ]

    const status: AuditEntryRecord['status'] = anomalies.some((item) => item.severity === 'blocking')
      ? 'blocked'
      : anomalies.some((item) => item.severity === 'warning') ? 'attention' : 'healthy'
    const entry: AuditEntryRecord = {
      id: randomUUID(),
      projectId: input.projectId,
      status,
      anomalies,
      checklist,
      createdAt: new Date().toISOString()
    }
    await this.repository.saveAudit(entry)
    return entry
  }
}
