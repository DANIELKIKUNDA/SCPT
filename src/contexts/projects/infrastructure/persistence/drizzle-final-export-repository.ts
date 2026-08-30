import Database from 'better-sqlite3'
import {
  ExportFinalAudiovisuel,
  type ExportFinalStatus,
  type ExportFinalTechnique
} from '../../domain/aggregates/export-final-audiovisuel'
import type { ExportFinalAudiovisuelRepository } from '../../domain/repositories/export-final-audiovisuel.repository'
import { DeclinaisonId } from '../../domain/value-objects/declinaison-id'
import { ExportId } from '../../domain/value-objects/export-id'
import { ProfilExport } from '../../domain/value-objects/profil-export'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'

interface FinalExportRow {
  id: string
  project_id: string
  render_job_id: string
  declinaison_id: string
  tentative: number
  statut: string
  progression: number
  profil: string
  source_render_checksum: string
  narration_take_id: string
  narration_checksum: string
  nom_fichier: string | null
  chemin_fichier: string | null
  checksum: string | null
  taille_octets: number | null
  duree_ms: number | null
  largeur: number | null
  hauteur: number | null
  fps: number | null
  codec_video: string | null
  pixel_format: string | null
  codec_audio: string | null
  audio_sample_rate: number | null
  diagnostic: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

const ACTIVE: ExportFinalStatus[] = ['demande', 'en_attente', 'en_preparation', 'en_encodage', 'en_verification']

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS final_exports (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      render_job_id TEXT NOT NULL,
      declinaison_id TEXT NOT NULL,
      tentative INTEGER NOT NULL,
      statut TEXT NOT NULL,
      progression INTEGER NOT NULL DEFAULT 0,
      profil TEXT NOT NULL,
      source_render_checksum TEXT NOT NULL,
      narration_take_id TEXT NOT NULL,
      narration_checksum TEXT NOT NULL,
      nom_fichier TEXT,
      chemin_fichier TEXT,
      checksum TEXT,
      taille_octets INTEGER,
      duree_ms INTEGER,
      largeur INTEGER,
      hauteur INTEGER,
      fps REAL,
      codec_video TEXT,
      pixel_format TEXT,
      codec_audio TEXT,
      audio_sample_rate INTEGER,
      diagnostic TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_final_exports_project ON final_exports(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_final_exports_render_job ON final_exports(render_job_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_final_exports_status ON final_exports(project_id, statut, updated_at);
  `)
}

function techniqueFromRow(row: FinalExportRow): ExportFinalTechnique | null {
  if (!row.chemin_fichier) return null
  if (
    !row.nom_fichier || !row.checksum || row.taille_octets === null || row.duree_ms === null ||
    row.largeur === null || row.hauteur === null || row.fps === null || !row.codec_video ||
    !row.pixel_format || !row.codec_audio || row.audio_sample_rate === null
  ) {
    throw new Error('FINAL_EXPORT_PERSISTENCE_INCOMPLETE_TECHNICAL_DATA')
  }
  return {
    nomFichier: row.nom_fichier,
    cheminFichier: row.chemin_fichier,
    checksum: row.checksum,
    tailleOctets: row.taille_octets,
    dureeMs: row.duree_ms,
    largeur: row.largeur,
    hauteur: row.hauteur,
    fps: row.fps,
    codecVideo: row.codec_video as 'h264',
    pixelFormat: row.pixel_format as 'yuv420p',
    codecAudio: row.codec_audio as 'aac',
    audioSampleRate: row.audio_sample_rate as 48000
  }
}

function mapRow(row: FinalExportRow): ExportFinalAudiovisuel {
  return ExportFinalAudiovisuel.fromPersistence({
    id: ExportId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.project_id),
    renderJobId: ExportId.from(row.render_job_id),
    declinaisonId: DeclinaisonId.from(row.declinaison_id),
    tentative: row.tentative,
    statut: row.statut as ExportFinalStatus,
    progression: row.progression,
    profil: ProfilExport.from(row.profil),
    sourceRenderChecksum: row.source_render_checksum,
    narrationTakeId: row.narration_take_id,
    narrationChecksum: row.narration_checksum,
    technique: techniqueFromRow(row),
    diagnostic: row.diagnostic,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    finishedAt: row.finished_at ? new Date(row.finished_at) : null
  })
}

export function createDrizzleFinalExportRepository(
  dbPath: string
): ExportFinalAudiovisuelRepository & { close(): void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureSchema(db)

  const upsert = db.prepare(`
    INSERT INTO final_exports (
      id, project_id, render_job_id, declinaison_id, tentative, statut, progression, profil,
      source_render_checksum, narration_take_id, narration_checksum,
      nom_fichier, chemin_fichier, checksum, taille_octets, duree_ms, largeur, hauteur, fps,
      codec_video, pixel_format, codec_audio, audio_sample_rate, diagnostic,
      created_at, updated_at, started_at, finished_at
    ) VALUES (
      @id, @project_id, @render_job_id, @declinaison_id, @tentative, @statut, @progression, @profil,
      @source_render_checksum, @narration_take_id, @narration_checksum,
      @nom_fichier, @chemin_fichier, @checksum, @taille_octets, @duree_ms, @largeur, @hauteur, @fps,
      @codec_video, @pixel_format, @codec_audio, @audio_sample_rate, @diagnostic,
      @created_at, @updated_at, @started_at, @finished_at
    )
    ON CONFLICT(id) DO UPDATE SET
      tentative = excluded.tentative,
      statut = excluded.statut,
      progression = excluded.progression,
      profil = excluded.profil,
      source_render_checksum = excluded.source_render_checksum,
      narration_take_id = excluded.narration_take_id,
      narration_checksum = excluded.narration_checksum,
      nom_fichier = excluded.nom_fichier,
      chemin_fichier = excluded.chemin_fichier,
      checksum = excluded.checksum,
      taille_octets = excluded.taille_octets,
      duree_ms = excluded.duree_ms,
      largeur = excluded.largeur,
      hauteur = excluded.hauteur,
      fps = excluded.fps,
      codec_video = excluded.codec_video,
      pixel_format = excluded.pixel_format,
      codec_audio = excluded.codec_audio,
      audio_sample_rate = excluded.audio_sample_rate,
      diagnostic = excluded.diagnostic,
      updated_at = excluded.updated_at,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at
  `)

  return {
    async save(value): Promise<void> {
      const row = value.toJSON()
      const tech = row.technique
      upsert.run({
        id: row.id.value,
        project_id: row.projetId.value,
        render_job_id: row.renderJobId.value,
        declinaison_id: row.declinaisonId.value,
        tentative: row.tentative,
        statut: row.statut,
        progression: row.progression,
        profil: row.profil.value,
        source_render_checksum: row.sourceRenderChecksum,
        narration_take_id: row.narrationTakeId,
        narration_checksum: row.narrationChecksum,
        nom_fichier: tech?.nomFichier ?? null,
        chemin_fichier: tech?.cheminFichier ?? null,
        checksum: tech?.checksum ?? null,
        taille_octets: tech?.tailleOctets ?? null,
        duree_ms: tech?.dureeMs ?? null,
        largeur: tech?.largeur ?? null,
        hauteur: tech?.hauteur ?? null,
        fps: tech?.fps ?? null,
        codec_video: tech?.codecVideo ?? null,
        pixel_format: tech?.pixelFormat ?? null,
        codec_audio: tech?.codecAudio ?? null,
        audio_sample_rate: tech?.audioSampleRate ?? null,
        diagnostic: row.diagnostic,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
        started_at: row.startedAt?.toISOString() ?? null,
        finished_at: row.finishedAt?.toISOString() ?? null
      })
    },

    async findById(id): Promise<ExportFinalAudiovisuel | null> {
      const row = db.prepare('SELECT * FROM final_exports WHERE id = ?').get(id.value) as FinalExportRow | undefined
      return row ? mapRow(row) : null
    },

    async findAllByProject(projectId): Promise<ExportFinalAudiovisuel[]> {
      const rows = db.prepare(`SELECT * FROM final_exports WHERE project_id = ? ORDER BY created_at DESC, id DESC`)
        .all(projectId.value) as FinalExportRow[]
      return rows.map(mapRow)
    },

    async findActiveByRenderJob(renderJobId): Promise<ExportFinalAudiovisuel | null> {
      const row = db.prepare(`
        SELECT * FROM final_exports
        WHERE render_job_id = ? AND statut IN (${placeholders(ACTIVE.length)})
        ORDER BY created_at DESC LIMIT 1
      `).get(renderJobId.value, ...ACTIVE) as FinalExportRow | undefined
      return row ? mapRow(row) : null
    },

    async findByStatuses(projectId, statuses): Promise<ExportFinalAudiovisuel[]> {
      if (statuses.length === 0) return []
      const rows = db.prepare(`
        SELECT * FROM final_exports
        WHERE project_id = ? AND statut IN (${placeholders(statuses.length)})
        ORDER BY created_at ASC, id ASC
      `).all(projectId.value, ...statuses) as FinalExportRow[]
      return rows.map(mapRow)
    },

    async maxAttemptForRenderJob(renderJobId): Promise<number> {
      const row = db.prepare('SELECT COALESCE(MAX(tentative), 0) AS attempt FROM final_exports WHERE render_job_id = ?')
        .get(renderJobId.value) as { attempt: number }
      return row.attempt
    },

    close(): void { db.close() }
  }
}
