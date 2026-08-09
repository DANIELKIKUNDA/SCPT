// SCPT Phase 2 — Rebuild better-sqlite3 for Node (tests) & Electron (runtime)
//
// WHY DUAL BINARIES ARE NECESSARY:
// Electron 33.4.11 embeds Node 20.18.3 (ABI 130).
// Tests run under Node 24 (ABI 137).
// better-sqlite3 is not purely N-API; its compiled .node embeds NODE_MODULE_VERSION.
// A binary compiled for ABI 130 won't load under ABI 137, and vice versa.
//
// Since both `pnpm test` (Node 24) and `pnpm dev`/`pnpm build` (Electron 33)
// share the same workspace, we maintain two binaries and swap automatically.
//
// MECHANISM (no manual patching):
// 1. Remove prebuilds → force source build
// 2. node-gyp rebuild → Node 24 binary → saved as .node.node24
// 3. electron-rebuild → Electron 33 binary → saved as .node.electron33
// 4. Leave Node 24 binary active (tests run immediately after install)
//
// At runtime (pnpm dev), electron-vite uses the installed Electron which
// auto-rebuilds via @electron/rebuild if needed. The binary is replaced
// by the Electron rebuild during pnpm package:win or pnpm dev startup.
//
// To switch manually if needed:
//   pnpm exec electron-rebuild --version=33.4.11 --only=better-sqlite3
//   (restores Node: copy .node.node24 → .node)

import { execSync } from 'child_process'
import { existsSync, rmSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const cwd = process.cwd()

function findPkgDir() {
  try {
    return dirname(dirname(require.resolve('better-sqlite3', { paths: [cwd] })))
  } catch { return null }
}

const pkgDir = findPkgDir()
if (!pkgDir) { console.log('[scpt] postinstall: better-sqlite3 not found'); process.exit(0) }

const prebuilds = join(pkgDir, 'prebuilds')
const build = join(pkgDir, 'build')
const nodeBin = join(build, 'Release', 'better_sqlite3.node')
const nodeBackup = join(build, 'Release', 'better_sqlite3.node.node24')
const electronBackup = join(build, 'Release', 'better_sqlite3.node.electron33')

// If both backups exist, restore Node binary and skip rebuild
if (existsSync(nodeBackup) && existsSync(electronBackup)) {
  copyFileSync(nodeBackup, nodeBin)
  console.log('[scpt] postinstall: restored Node 24 binary (backups exist)')
  process.exit(0)
}

// Clean prebuilds to force source build
if (existsSync(prebuilds)) {
  rmSync(prebuilds, { recursive: true, force: true })
}
if (existsSync(build)) {
  rmSync(build, { recursive: true, force: true })
}

// Step 1: Build for Node 24 (pnpm's implicit postinstall will trigger this)
if (!existsSync(nodeBin)) {
  try {
    execSync('npx --no-install node-gyp rebuild --release', {
      cwd: pkgDir, stdio: 'inherit', shell: true
    })
  } catch { /* pnpm already built it */ }
}

if (existsSync(nodeBin)) {
  copyFileSync(nodeBin, nodeBackup)
  console.log('[scpt] postinstall: saved Node 24 binary')
}

// Step 2: Rebuild for Electron 33
try {
  execSync('pnpm exec electron-rebuild --version=33.4.11 --only=better-sqlite3', {
    cwd, stdio: 'inherit'
  })
  if (existsSync(nodeBin)) {
    copyFileSync(nodeBin, electronBackup)
    console.log('[scpt] postinstall: saved Electron 33 binary')
  }
} catch (err) {
  console.error('[scpt] postinstall: Electron rebuild failed —', err.message)
}

// Step 3: Restore Node binary so tests work
if (existsSync(nodeBackup)) {
  copyFileSync(nodeBackup, nodeBin)
  console.log('[scpt] postinstall: restored Node 24 binary (tests ready)')
}

console.log('[scpt] postinstall: done')