// SCPT Phase 2 — Persistence integration test for Electron
const Database = require('better-sqlite3');
const { ulid } = require('ulid');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.tmpdir(), 'scpt-persistence-test.sqlite');

// Clean up from previous runs
try { fs.unlinkSync(dbPath); } catch (e) {}

console.log('=== PERSISTENCE TEST ===');
console.log('DB path:', dbPath);

// Step 1: Create
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    titre TEXT NOT NULL,
    type TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'BROUILLON',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const projectId = ulid();
const now = new Date().toISOString();
db.prepare('INSERT INTO projects (id, titre, type, statut, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(projectId, 'Test Projet', 'CAPTATION', 'BROUILLON', now, now);

console.log('CREATED:', projectId);
db.close();

// Step 2: Reopen
const db2 = new Database(dbPath);
const row = db2.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
if (!row) {
  console.error('FAIL: project not found after reopen');
  process.exit(1);
}
console.log('FOUND:', row.id, row.titre, row.type, row.statut);
db2.close();

// Step 3: Clean up
fs.unlinkSync(dbPath);
console.log('=== PERSISTENCE TEST PASSED ===');
process.exit(0);