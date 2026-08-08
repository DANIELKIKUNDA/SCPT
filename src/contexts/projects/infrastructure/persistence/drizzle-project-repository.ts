// DrizzleProjetAudiovisuelRepository — SQLite adapter
// NOTE: This requires better-sqlite3 to be built (Visual Studio Build Tools needed on Windows).
// The InMemoryProjetAudiovisuelRepository is used for tests until the native build is available.

import type { ProjetAudiovisuelRepository } from '../../domain/repositories/projet-audiovisuel.repository'

// Placeholder — will be implemented when better-sqlite3 is available
export const createDrizzleProjectRepository = (): ProjetAudiovisuelRepository => {
  throw new Error(
    'DrizzleProjetAudiovisuelRepository requires better-sqlite3 native build (Visual Studio Build Tools required on Windows)'
  )
}

// Schema definition for drizzle-kit (available for reference)
export const projectsTableDef = {
  name: 'projects',
  columns: {
    id: 'TEXT PRIMARY KEY NOT NULL',
    titre: 'TEXT NOT NULL',
    type: 'TEXT NOT NULL',
    objectif: "TEXT NOT NULL DEFAULT ''",
    public_cible: "TEXT NOT NULL DEFAULT ''",
    langue_source: 'TEXT NOT NULL',
    statut: "TEXT NOT NULL DEFAULT 'BROUILLON'",
    version: 'INTEGER NOT NULL DEFAULT 1',
    created_at: 'TEXT NOT NULL',
    updated_at: 'TEXT NOT NULL',
    archived_at: 'TEXT',
    previous_statut: 'TEXT'
  }
}