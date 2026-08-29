import Database from 'better-sqlite3'
import {
  DeclinaisonAudiovisuelle,
  type DeclinaisonSceneLayout,
  type DeclinaisonSceneOverride,
  type DeclinaisonStatus
} from '../../domain/aggregates/declinaison-audiovisuelle'
import type { DeclinaisonAudiovisuelleRepository } from '../../domain/repositories/declinaison-audiovisuelle.repository'
import { DeclinaisonId } from '../../domain/value-objects/declinaison-id'
import { FormatVideo } from '../../domain/value-objects/format-video'
import { ProfilExport } from '../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { ResolutionVideo } from '../../domain/value-objects/resolution-video'
import { VersionMetier } from '../../domain/value-objects/version-metier'

interface DeclinaisonRow {
  id: string
  project_id: string
  format: string
  width: number
  height: number
  langue: string
  profil_export: string
  statut: string
  version_project_source: number
  version: number
  created_at: string
  updated_at: string
}

interface OverrideRow {
  declinaison_id: string
  scene_id: string
  layout_override: string | null
  background_color_override: string | null
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS declinaisons (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      format TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      langue TEXT NOT NULL,
      profil_export TEXT NOT NULL,
      statut TEXT NOT NULL,
      version_project_source INTEGER NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS declinaison_scene_overrides (
      declinaison_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      layout_override TEXT,
      background_color_override TEXT,
      PRIMARY KEY(declinaison_id, scene_id),
      FOREIGN KEY(declinaison_id) REFERENCES declinaisons(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_declinaisons_project ON declinaisons(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_declinaisons_signature ON declinaisons(project_id, format, langue, profil_export, statut);
  `)
}

function mapDeclinaison(row: DeclinaisonRow, overrideRows: OverrideRow[]): DeclinaisonAudiovisuelle {
  const overrides: DeclinaisonSceneOverride[] = overrideRows.map((override) => ({
    sceneId: override.scene_id,
    layout: override.layout_override ? override.layout_override as DeclinaisonSceneLayout : undefined,
    backgroundColor: override.background_color_override ?? undefined
  }))
  return DeclinaisonAudiovisuelle.fromPersistence({
    id: DeclinaisonId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.project_id),
    format: FormatVideo.from(row.format),
    resolution: ResolutionVideo.from(row.width, row.height),
    langue: row.langue,
    profilExport: ProfilExport.from(row.profil_export),
    statut: row.statut as DeclinaisonStatus,
    versionProjetSource: VersionMetier.from(row.version_project_source),
    version: VersionMetier.from(row.version),
    overrides
  })
}

export function createDrizzleDeclinaisonRepository(
  dbPath: string
): DeclinaisonAudiovisuelleRepository & { close(): void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  ensureSchema(db)

  const upsert = db.prepare(`
    INSERT INTO declinaisons (
      id, project_id, format, width, height, langue, profil_export, statut,
      version_project_source, version, created_at, updated_at
    ) VALUES (
      @id, @project_id, @format, @width, @height, @langue, @profil_export, @statut,
      @version_project_source, @version, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      format = excluded.format,
      width = excluded.width,
      height = excluded.height,
      langue = excluded.langue,
      profil_export = excluded.profil_export,
      statut = excluded.statut,
      version_project_source = excluded.version_project_source,
      version = excluded.version,
      updated_at = excluded.updated_at
  `)
  const removeOverrides = db.prepare('DELETE FROM declinaison_scene_overrides WHERE declinaison_id = ?')
  const insertOverride = db.prepare(`
    INSERT INTO declinaison_scene_overrides (
      declinaison_id, scene_id, layout_override, background_color_override
    ) VALUES (?, ?, ?, ?)
  `)

  const saveTransaction = db.transaction((declinaison: DeclinaisonAudiovisuelle) => {
    const json = declinaison.toJSON()
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT created_at FROM declinaisons WHERE id = ?').get(json.id.value) as { created_at: string } | undefined
    upsert.run({
      id: json.id.value,
      project_id: json.projetId.value,
      format: json.format.value,
      width: json.resolution.width,
      height: json.resolution.height,
      langue: json.langue,
      profil_export: json.profilExport.value,
      statut: json.statut,
      version_project_source: json.versionProjetSource.value,
      version: json.version.value,
      created_at: existing?.created_at ?? now,
      updated_at: now
    })
    removeOverrides.run(json.id.value)
    for (const override of json.overrides) {
      insertOverride.run(
        json.id.value,
        override.sceneId,
        override.layout ?? null,
        override.backgroundColor ?? null
      )
    }
  })

  function loadOne(sql: string, params: unknown[]): DeclinaisonAudiovisuelle | null {
    const row = db.prepare(sql).get(...params) as DeclinaisonRow | undefined
    if (!row) return null
    const overrides = db.prepare(`
      SELECT * FROM declinaison_scene_overrides
      WHERE declinaison_id = ? ORDER BY scene_id ASC
    `).all(row.id) as OverrideRow[]
    return mapDeclinaison(row, overrides)
  }

  return {
    async save(declinaison): Promise<void> {
      saveTransaction(declinaison)
    },
    async findById(id): Promise<DeclinaisonAudiovisuelle | null> {
      return loadOne('SELECT * FROM declinaisons WHERE id = ?', [id.value])
    },
    async findAllByProject(projectId): Promise<DeclinaisonAudiovisuelle[]> {
      const rows = db.prepare(`
        SELECT * FROM declinaisons
        WHERE project_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(projectId.value) as DeclinaisonRow[]
      return rows.map((row) => {
        const overrides = db.prepare(`
          SELECT * FROM declinaison_scene_overrides
          WHERE declinaison_id = ? ORDER BY scene_id ASC
        `).all(row.id) as OverrideRow[]
        return mapDeclinaison(row, overrides)
      })
    },
    async findCurrentBySignature(input): Promise<DeclinaisonAudiovisuelle | null> {
      return loadOne(`
        SELECT * FROM declinaisons
        WHERE project_id = ? AND format = ? AND langue = ? AND profil_export = ? AND statut != 'obsolete'
        ORDER BY created_at DESC, id DESC LIMIT 1
      `, [input.projectId.value, input.format.value, input.langue, input.profilExport.value])
    },
    close(): void {
      db.close()
    }
  }
}
