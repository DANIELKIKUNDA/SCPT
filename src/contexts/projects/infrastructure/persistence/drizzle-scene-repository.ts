import Database from 'better-sqlite3'
import { Scene } from '../../domain/aggregates/scene'
import { SceneId } from '../../domain/value-objects/scene-id'
import { VersionMetier } from '../../domain/value-objects/version-metier'
import { ProjetAudiovisuelId } from '../../domain/value-objects/projet-audiovisuel-id'
import type { SequenceSceneRepository } from '../../domain/repositories/sequence-scene.repository'
import type { SceneType } from '../../domain/value-objects/scene-type'

interface SceneRow {
  id: string
  projet_id: string
  ordre: number
  type: string
  titre: string | null
  narration_texte: string | null
  texte_affiche: string | null
  duree_ms: number
  composition_json: string
  transition_json: string
  version: number
  media_id: string | null
}

const CREATE_SCENES_TABLE = `
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY NOT NULL,
    projet_id TEXT NOT NULL,
    ordre INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('texte','formule','image','code','diagramme')),
    titre TEXT,
    narration_texte TEXT,
    texte_affiche TEXT,
    duree_ms INTEGER NOT NULL DEFAULT 5000,
    composition_json TEXT NOT NULL DEFAULT '{}',
    transition_json TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    media_id TEXT
  )
`

function ensurePhase5SceneSchema(db: Database.Database): void {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='scenes'").get() as
    | { sql: string }
    | undefined

  if (!table) {
    db.exec(CREATE_SCENES_TABLE)
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_projet_ordre ON scenes(projet_id, ordre)')
    return
  }

  const columns = db.prepare('PRAGMA table_info(scenes)').all() as Array<{ name: string }>
  const hasMediaId = columns.some((column) => column.name === 'media_id')
  const acceptsDiagramme = table.sql.includes("'diagramme'")

  if (hasMediaId && acceptsDiagramme) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_projet_ordre ON scenes(projet_id, ordre)')
    return
  }

  const mediaProjection = hasMediaId ? 'media_id' : 'NULL AS media_id'
  const migrate = db.transaction(() => {
    db.exec('DROP INDEX IF EXISTS idx_scenes_projet_ordre')
    db.exec('ALTER TABLE scenes RENAME TO scenes_phase4_backup')
    db.exec(CREATE_SCENES_TABLE)
    db.exec(`
      INSERT INTO scenes (
        id, projet_id, ordre, type, titre, narration_texte, texte_affiche,
        duree_ms, composition_json, transition_json, version, media_id
      )
      SELECT
        id, projet_id, ordre, type, titre, narration_texte, texte_affiche,
        duree_ms, composition_json, transition_json, version, ${mediaProjection}
      FROM scenes_phase4_backup
    `)
    db.exec('DROP TABLE scenes_phase4_backup')
    db.exec('CREATE UNIQUE INDEX idx_scenes_projet_ordre ON scenes(projet_id, ordre)')
  })

  migrate()
}

function sceneToRow(scene: Scene, mediaId: string | null = null): SceneRow {
  const json = scene.toJSON()
  return {
    id: json.id.value,
    projet_id: json.projetId.value,
    ordre: json.ordre,
    type: json.type,
    titre: json.titre,
    narration_texte: json.narrationTexte,
    texte_affiche: json.texteAffiche,
    duree_ms: json.dureeMs,
    composition_json: JSON.stringify(json.composition),
    transition_json: JSON.stringify(json.transition),
    version: json.version.value,
    media_id: mediaId
  }
}

function rowToScene(row: SceneRow): Scene {
  return Scene.fromPersistence({
    id: SceneId.from(row.id),
    projetId: ProjetAudiovisuelId.from(row.projet_id),
    ordre: row.ordre,
    type: row.type as SceneType,
    titre: row.titre,
    narrationTexte: row.narration_texte,
    texteAffiche: row.texte_affiche,
    dureeMs: row.duree_ms,
    composition: JSON.parse(row.composition_json),
    transition: JSON.parse(row.transition_json),
    version: VersionMetier.from(row.version)
  })
}

export function createDrizzleSceneRepository(dbPath: string): SequenceSceneRepository & {
  associateMedia: (sceneId: SceneId, mediaId: string | null) => Promise<void>
  getMediaId: (sceneId: SceneId) => Promise<string | null>
  close: () => void
} {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensurePhase5SceneSchema(db)

  // New rows keep Phase 3 INSERT OR REPLACE semantics for the unique order invariant.
  // Existing rows use UPDATE so autosave never clears the Phase 4 media association.
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO scenes (
      id, projet_id, ordre, type, titre, narration_texte, texte_affiche,
      duree_ms, composition_json, transition_json, version, media_id
    )
    VALUES (
      @id, @projet_id, @ordre, @type, @titre, @narration_texte, @texte_affiche,
      @duree_ms, @composition_json, @transition_json, @version, @media_id
    )
  `)

  const updateStmt = db.prepare(`
    UPDATE scenes SET
      projet_id = @projet_id,
      ordre = @ordre,
      type = @type,
      titre = @titre,
      narration_texte = @narration_texte,
      texte_affiche = @texte_affiche,
      duree_ms = @duree_ms,
      composition_json = @composition_json,
      transition_json = @transition_json,
      version = @version
    WHERE id = @id
  `)

  const findByProjetStmt = db.prepare('SELECT * FROM scenes WHERE projet_id = ? ORDER BY ordre ASC')
  const findByIdStmt = db.prepare('SELECT * FROM scenes WHERE id = ?')
  const maxOrdreStmt = db.prepare('SELECT COALESCE(MAX(ordre), 0) as max_ordre FROM scenes WHERE projet_id = ?')
  const deleteStmt = db.prepare('DELETE FROM scenes WHERE id = ?')
  const updateOrdreStmt = db.prepare('UPDATE scenes SET ordre = ? WHERE id = ?')
  const compactOrdreStmt = db.prepare(`
    UPDATE scenes SET ordre = (
      SELECT COUNT(*) FROM scenes AS s2
      WHERE s2.projet_id = scenes.projet_id AND s2.ordre <= scenes.ordre
    ) WHERE projet_id = ?
  `)
  const associateMediaStmt = db.prepare('UPDATE scenes SET media_id = ? WHERE id = ?')
  const getMediaIdStmt = db.prepare('SELECT media_id FROM scenes WHERE id = ?')

  return {
    async loadSequence(projetId: ProjetAudiovisuelId): Promise<Scene[]> {
      const rows = findByProjetStmt.all(projetId.value) as SceneRow[]
      return rows.map(rowToScene)
    },

    async save(scene: Scene): Promise<void> {
      const existing = findByIdStmt.get(scene.id.value) as SceneRow | undefined
      if (existing) updateStmt.run(sceneToRow(scene, existing.media_id))
      else insertStmt.run(sceneToRow(scene))
    },

    async findById(id: SceneId): Promise<Scene | null> {
      const row = findByIdStmt.get(id.value) as SceneRow | undefined
      return row ? rowToScene(row) : null
    },

    async duplicate(id: SceneId): Promise<Scene> {
      const original = findByIdStmt.get(id.value) as SceneRow | undefined
      if (!original) throw new Error(`Scene not found: ${id.value}`)

      const nextOrdre = (maxOrdreStmt.get(original.projet_id) as { max_ordre: number }).max_ordre + 1
      const duplicate = Scene.create({
        id: SceneId.generate(),
        projetId: ProjetAudiovisuelId.from(original.projet_id),
        ordre: nextOrdre,
        type: original.type as SceneType,
        titre: original.titre ? `${original.titre} (copie)` : null,
        narrationTexte: original.narration_texte,
        texteAffiche: original.texte_affiche,
        dureeMs: original.duree_ms,
        composition: JSON.parse(original.composition_json),
        transition: JSON.parse(original.transition_json)
      })

      insertStmt.run(sceneToRow(duplicate, original.media_id))
      const saved = findByIdStmt.get(duplicate.id.value) as SceneRow
      return rowToScene(saved)
    },

    async delete(id: SceneId): Promise<void> {
      const scene = findByIdStmt.get(id.value) as SceneRow | undefined
      if (!scene) throw new Error(`Scene not found: ${id.value}`)

      const deleteInTx = db.transaction(() => {
        deleteStmt.run(id.value)
        compactOrdreStmt.run(scene.projet_id)
      })
      deleteInTx()
    },

    async reorder(projectId: ProjetAudiovisuelId, orderedIds: SceneId[]): Promise<void> {
      const reorderTx = db.transaction(() => {
        const currentScenes = findByProjetStmt.all(projectId.value) as SceneRow[]
        const currentIds = new Set(currentScenes.map((scene) => scene.id))
        const newIds = new Set(orderedIds.map((id) => id.value))

        if (currentIds.size !== newIds.size || ![...currentIds].every((id) => newIds.has(id))) {
          throw new Error('Reorder must include exactly the same scene IDs')
        }

        const offset = currentScenes.length + 1
        currentScenes.forEach((scene, index) => {
          updateOrdreStmt.run(-(index + 1) - offset, scene.id)
        })

        orderedIds.forEach((sceneId, index) => {
          updateOrdreStmt.run(index + 1, sceneId.value)
        })
      })
      reorderTx()
    },

    async nextOrdre(projetId: ProjetAudiovisuelId): Promise<number> {
      const row = maxOrdreStmt.get(projetId.value) as { max_ordre: number }
      return row.max_ordre + 1
    },

    async associateMedia(sceneId: SceneId, mediaId: string | null): Promise<void> {
      associateMediaStmt.run(mediaId, sceneId.value)
    },

    async getMediaId(sceneId: SceneId): Promise<string | null> {
      const row = getMediaIdStmt.get(sceneId.value) as { media_id: string | null } | undefined
      return row?.media_id ?? null
    },

    close(): void {
      db.close()
    }
  }
}
