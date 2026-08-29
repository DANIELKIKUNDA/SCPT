import Database from 'better-sqlite3'
import {
  PisteSousTitres,
  type SegmentSousTitre,
  type SubtitlePosition,
  type SubtitleStyle,
  type SubtitleTrackStatus
} from '../../domain/aggregates/piste-sous-titres'
import type { PisteSousTitresRepository } from '../../domain/repositories/piste-sous-titres.repository'
import { DeclinaisonId } from '../../domain/value-objects/declinaison-id'
import { PisteSousTitresId } from '../../domain/value-objects/piste-sous-titres-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'

interface TrackRow {
  id: string
  declinaison_id: string
  langue: string
  statut: string
  version_narration: number
  created_at: string
  updated_at: string
}

interface SegmentRow {
  id: string
  track_id: string
  ordre: number
  debut_ms: number
  fin_ms: number
  texte: string
  position: string
  style_json: string | null
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtitle_tracks (
      id TEXT PRIMARY KEY NOT NULL,
      declinaison_id TEXT NOT NULL UNIQUE,
      langue TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      version_narration INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtitle_segments (
      id TEXT PRIMARY KEY NOT NULL,
      track_id TEXT NOT NULL,
      ordre INTEGER NOT NULL,
      debut_ms INTEGER NOT NULL,
      fin_ms INTEGER NOT NULL,
      texte TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT 'bas',
      style_json TEXT,
      FOREIGN KEY(track_id) REFERENCES subtitle_tracks(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_subtitle_track_declinaison ON subtitle_tracks(declinaison_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subtitle_segment_order ON subtitle_segments(track_id, ordre);
    CREATE INDEX IF NOT EXISTS idx_subtitle_segment_interval ON subtitle_segments(track_id, debut_ms, fin_ms);
  `)
}

function parseStyle(value: string | null): SubtitleStyle | undefined {
  if (!value) return undefined
  try {
    return JSON.parse(value) as SubtitleStyle
  } catch {
    throw new Error('Invalid persisted subtitle style')
  }
}

function mapTrack(row: TrackRow, rows: SegmentRow[]): PisteSousTitres {
  const segments: SegmentSousTitre[] = rows.map((segment) => ({
    id: segment.id,
    ordre: segment.ordre,
    debutMs: segment.debut_ms,
    finMs: segment.fin_ms,
    texte: segment.texte,
    position: segment.position as SubtitlePosition,
    style: parseStyle(segment.style_json)
  }))
  return PisteSousTitres.fromPersistence({
    id: PisteSousTitresId.from(row.id),
    declinaisonId: DeclinaisonId.from(row.declinaison_id),
    langue: row.langue,
    segments,
    statut: row.statut as SubtitleTrackStatus,
    versionNarration: VersionMetier.from(row.version_narration)
  })
}

export function createDrizzleSubtitleRepository(
  dbPath: string
): PisteSousTitresRepository & { close: () => void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  ensureSchema(db)

  const upsertTrack = db.prepare(`
    INSERT INTO subtitle_tracks (
      id, declinaison_id, langue, statut, version_narration, created_at, updated_at
    ) VALUES (
      @id, @declinaison_id, @langue, @statut, @version_narration, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      declinaison_id = excluded.declinaison_id,
      langue = excluded.langue,
      statut = excluded.statut,
      version_narration = excluded.version_narration,
      updated_at = excluded.updated_at
  `)
  const deleteSegments = db.prepare('DELETE FROM subtitle_segments WHERE track_id = ?')
  const insertSegment = db.prepare(`
    INSERT INTO subtitle_segments (
      id, track_id, ordre, debut_ms, fin_ms, texte, position, style_json
    ) VALUES (
      @id, @track_id, @ordre, @debut_ms, @fin_ms, @texte, @position, @style_json
    )
  `)

  const saveTransaction = db.transaction((track: PisteSousTitres) => {
    const json = track.toJSON()
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT created_at FROM subtitle_tracks WHERE id = ?').get(json.id.value) as { created_at: string } | undefined
    upsertTrack.run({
      id: json.id.value,
      declinaison_id: json.declinaisonId.value,
      langue: json.langue,
      statut: json.statut,
      version_narration: json.versionNarration.value,
      created_at: existing?.created_at ?? now,
      updated_at: now
    })
    deleteSegments.run(json.id.value)
    for (const segment of json.segments) {
      insertSegment.run({
        id: segment.id,
        track_id: json.id.value,
        ordre: segment.ordre,
        debut_ms: segment.debutMs,
        fin_ms: segment.finMs,
        texte: segment.texte,
        position: segment.position,
        style_json: segment.style ? JSON.stringify(segment.style) : null
      })
    }
  })

  function load(sql: string, value?: string): PisteSousTitres | null {
    const row = (value === undefined ? db.prepare(sql).get() : db.prepare(sql).get(value)) as TrackRow | undefined
    if (!row) return null
    const segments = db.prepare('SELECT * FROM subtitle_segments WHERE track_id = ? ORDER BY ordre ASC').all(row.id) as SegmentRow[]
    return mapTrack(row, segments)
  }

  return {
    async save(track: PisteSousTitres): Promise<void> {
      saveTransaction(track)
    },
    async findById(id: PisteSousTitresId): Promise<PisteSousTitres | null> {
      return load('SELECT * FROM subtitle_tracks WHERE id = ?', id.value)
    },
    async findByDeclinaison(declinaisonId: DeclinaisonId): Promise<PisteSousTitres | null> {
      return load('SELECT * FROM subtitle_tracks WHERE declinaison_id = ?', declinaisonId.value)
    },
    async findMaster(): Promise<PisteSousTitres | null> {
      return load('SELECT * FROM subtitle_tracks ORDER BY created_at ASC LIMIT 1')
    },
    close(): void {
      db.close()
    }
  }
}
