import Database from 'better-sqlite3'
import { PisteNarration, type NarrationSegmentStatus, type NarrationSource, type NarrationTrackStatus, type SegmentNarration } from '../../domain/aggregates/piste-narration'
import { PisteNarrationId } from '../../domain/value-objects/piste-narration-id'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'
import type { PisteNarrationRepository } from '../../domain/repositories/piste-narration.repository'

interface TrackRow {
  id: string
  projet_id: string
  langue: string
  prise_finale_id: string | null
  statut: string
  version_texte: number
  created_at: string
  updated_at: string
}

interface SegmentRow {
  id: string
  track_id: string
  scene_id: string | null
  ordre: number
  texte: string
  fichier_audio: string
  duree_ms: number
  statut: string
  source: string
  voix_id: string | null
  checksum: string
  created_at: string
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS narration_tracks (
      id TEXT PRIMARY KEY NOT NULL,
      projet_id TEXT NOT NULL UNIQUE,
      langue TEXT NOT NULL,
      prise_finale_id TEXT,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      version_texte INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS narration_segments (
      id TEXT PRIMARY KEY NOT NULL,
      track_id TEXT NOT NULL,
      scene_id TEXT,
      ordre INTEGER NOT NULL,
      texte TEXT NOT NULL DEFAULT '',
      fichier_audio TEXT NOT NULL,
      duree_ms INTEGER NOT NULL,
      statut TEXT NOT NULL,
      source TEXT NOT NULL,
      voix_id TEXT,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(track_id) REFERENCES narration_tracks(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_narration_track_project ON narration_tracks(projet_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_narration_segment_order ON narration_segments(track_id, ordre);
  `)
}

function mapTrack(row: TrackRow, segments: SegmentRow[]): PisteNarration {
  const mapped: SegmentNarration[] = segments.map((segment) => ({
    id: segment.id,
    texte: segment.texte,
    sceneId: segment.scene_id,
    fichierAudio: segment.fichier_audio,
    dureeMs: segment.duree_ms,
    ordre: segment.ordre,
    statut: segment.statut as NarrationSegmentStatus,
    source: segment.source as NarrationSource,
    voixId: segment.voix_id,
    checksum: segment.checksum,
    createdAt: segment.created_at
  }))

  return PisteNarration.fromPersistence({
    id: PisteNarrationId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.projet_id),
    langue: row.langue,
    segments: mapped,
    priseFinaleId: row.prise_finale_id,
    statut: row.statut as NarrationTrackStatus,
    versionTexte: VersionMetier.from(row.version_texte)
  })
}

export function createDrizzleNarrationRepository(dbPath: string): PisteNarrationRepository & { close: () => void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  ensureSchema(db)

  const upsertTrack = db.prepare(`
    INSERT INTO narration_tracks (
      id, projet_id, langue, prise_finale_id, statut, version_texte, created_at, updated_at
    ) VALUES (
      @id, @projet_id, @langue, @prise_finale_id, @statut, @version_texte, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      langue = excluded.langue,
      prise_finale_id = excluded.prise_finale_id,
      statut = excluded.statut,
      version_texte = excluded.version_texte,
      updated_at = excluded.updated_at
  `)

  const deleteSegments = db.prepare('DELETE FROM narration_segments WHERE track_id = ?')
  const insertSegment = db.prepare(`
    INSERT INTO narration_segments (
      id, track_id, scene_id, ordre, texte, fichier_audio, duree_ms,
      statut, source, voix_id, checksum, created_at
    ) VALUES (
      @id, @track_id, @scene_id, @ordre, @texte, @fichier_audio, @duree_ms,
      @statut, @source, @voix_id, @checksum, @created_at
    )
  `)

  const saveTransaction = db.transaction((track: PisteNarration) => {
    const json = track.toJSON()
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT created_at FROM narration_tracks WHERE id = ?').get(track.id.value) as { created_at: string } | undefined
    upsertTrack.run({
      id: json.id.value,
      projet_id: json.projetId.value,
      langue: json.langue,
      prise_finale_id: json.priseFinaleId,
      statut: json.statut,
      version_texte: json.versionTexte.value,
      created_at: existing?.created_at ?? now,
      updated_at: now
    })
    deleteSegments.run(json.id.value)
    for (const segment of json.segments) {
      insertSegment.run({
        id: segment.id,
        track_id: json.id.value,
        scene_id: segment.sceneId,
        ordre: segment.ordre,
        texte: segment.texte,
        fichier_audio: segment.fichierAudio,
        duree_ms: segment.dureeMs,
        statut: segment.statut,
        source: segment.source,
        voix_id: segment.voixId,
        checksum: segment.checksum,
        created_at: segment.createdAt
      })
    }
  })

  function loadByClause(sql: string, value: string): PisteNarration | null {
    const row = db.prepare(sql).get(value) as TrackRow | undefined
    if (!row) return null
    const segments = db.prepare('SELECT * FROM narration_segments WHERE track_id = ? ORDER BY ordre ASC').all(row.id) as SegmentRow[]
    return mapTrack(row, segments)
  }

  return {
    async save(track: PisteNarration): Promise<void> {
      saveTransaction(track)
    },
    async findById(id: PisteNarrationId): Promise<PisteNarration | null> {
      return loadByClause('SELECT * FROM narration_tracks WHERE id = ?', id.value)
    },
    async findByProject(projetId: ProjetAudiovisuelId): Promise<PisteNarration | null> {
      return loadByClause('SELECT * FROM narration_tracks WHERE projet_id = ?', projetId.value)
    },
    close(): void {
      db.close()
    }
  }
}
