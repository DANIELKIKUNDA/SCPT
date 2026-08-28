import Database from 'better-sqlite3'
import { RessourceMedia } from '../../domain/aggregates/ressource-media'
import { RessourceMediaId } from '../../domain/value-objects/ressource-media-id'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'
import type { RessourceMediaRepository } from '../../domain/repositories/ressource-media.repository'
import type { MediaType } from '../../domain/value-objects/ressource-media-type'
import type { MediaStatut, MediaDroits } from '../../domain/aggregates/ressource-media'

interface MediaRow {
  id: string
  projet_id: string
  type: string
  chemin_relatif: string
  nom_original: string
  checksum: string
  taille_octets: number
  mime_type: string
  duree_ms: number | null
  largeur: number | null
  hauteur: number | null
  statut: string
  droits: string
  version: number
  source_media_id: string | null
}

function mediaToRow(media: RessourceMedia): MediaRow {
  return {
    id: media.id.value,
    projet_id: media.projetId.value,
    type: media.type,
    chemin_relatif: media.cheminRelatif,
    nom_original: media.nomOriginal,
    checksum: media.checksum,
    taille_octets: media.tailleOctets,
    mime_type: media.mimeType,
    duree_ms: media.dureeMs,
    largeur: media.largeur,
    hauteur: media.hauteur,
    statut: media.statut,
    droits: media.droits,
    version: media.version.value,
    source_media_id: media.sourceMediaId?.value ?? null
  }
}

function rowToMedia(row: MediaRow): RessourceMedia {
  return RessourceMedia.fromPersistence({
    id: RessourceMediaId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.projet_id),
    type: row.type as MediaType,
    cheminRelatif: row.chemin_relatif,
    nomOriginal: row.nom_original,
    checksum: row.checksum,
    tailleOctets: row.taille_octets,
    mimeType: row.mime_type,
    dureeMs: row.duree_ms,
    largeur: row.largeur,
    hauteur: row.hauteur,
    statut: row.statut as MediaStatut,
    droits: row.droits as MediaDroits,
    version: VersionMetier.from(row.version),
    sourceMediaId: row.source_media_id ? RessourceMediaId.from(row.source_media_id) : null
  })
}

export function createDrizzleMediaRepository(dbPath: string): RessourceMediaRepository & { close: () => void } {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Migration: create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ressources_media (
      id TEXT PRIMARY KEY NOT NULL,
      projet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      chemin_relatif TEXT NOT NULL,
      nom_original TEXT NOT NULL,
      checksum TEXT NOT NULL,
      taille_octets INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      duree_ms INTEGER,
      largeur INTEGER,
      hauteur INTEGER,
      statut TEXT NOT NULL DEFAULT 'disponible',
      droits TEXT NOT NULL DEFAULT 'inconnue',
      version INTEGER NOT NULL DEFAULT 1,
      source_media_id TEXT
    )
  `)

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO ressources_media (id, projet_id, type, chemin_relatif, nom_original, checksum, taille_octets, mime_type, duree_ms, largeur, hauteur, statut, droits, version, source_media_id)
    VALUES (@id, @projet_id, @type, @chemin_relatif, @nom_original, @checksum, @taille_octets, @mime_type, @duree_ms, @largeur, @hauteur, @statut, @droits, @version, @source_media_id)
  `)

  const findByIdStmt = db.prepare('SELECT * FROM ressources_media WHERE id = ?')
  const findAllStmt = db.prepare('SELECT * FROM ressources_media WHERE projet_id = ? ORDER BY nom_original')
  const findByChecksumStmt = db.prepare('SELECT * FROM ressources_media WHERE projet_id = ? AND checksum = ?')
  const deleteStmt = db.prepare('DELETE FROM ressources_media WHERE id = ?')

  return {
    async save(media: RessourceMedia): Promise<void> {
      insertStmt.run(mediaToRow(media))
    },
    async findById(id: RessourceMediaId): Promise<RessourceMedia | null> {
      const row = findByIdStmt.get(id.value) as MediaRow | undefined
      return row ? rowToMedia(row) : null
    },
    async findAll(projetId: ProjetAudiovisuelId): Promise<RessourceMedia[]> {
      const rows = findAllStmt.all(projetId.value) as MediaRow[]
      return rows.map(rowToMedia)
    },
    async findByChecksum(projetId: ProjetAudiovisuelId, checksum: string): Promise<RessourceMedia | null> {
      const row = findByChecksumStmt.get(projetId.value, checksum) as MediaRow | undefined
      return row ? rowToMedia(row) : null
    },
    async delete(id: RessourceMediaId): Promise<void> {
      deleteStmt.run(id.value)
    },
    close(): void {
      db.close()
    }
  }
}