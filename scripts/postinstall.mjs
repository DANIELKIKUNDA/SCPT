// SCPT Phase 2 — Rebuild better-sqlite3 for Node (tests) & Electron (runtime)
// Strategy: build for Node, save backup; rebuild for Electron, save backup; restore Node for tests.
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

// Only run if no prebuilds exist (pnpm restore would have skipped build)
if (existsSync(prebuilds)) {
  rmSync(prebuilds, { recursive: true, force: true })
  if (existsSync(build)) rmSync(build, { recursive: true, force: true })
}

// If already have both backups, just restore Node binary
if (existsSync(nodeBackup) && existsSync(electronBackup)) {
  copyFileSync(nodeBackup, nodeBin)
  console.log('[scpt] postinstall: restored Node 24 binary from backup')
  process.exit(0)
}

// Build for Node 24 (pnpm's implicit postinstall already did this if build exists)
if (!existsSync(nodeBin)) {
  try {
    execSync('npx node-gyp rebuild --release', { cwd: pkgDir, stdio: 'inherit', shell: true })
  } catch {
    console.log('[scpt] postinstall: Node 24 build failed, may already exist')
  }
}

if (existsSync(nodeBin)) {
  if (!existsSync(nodeBackup)) copyFileSync(nodeBin, nodeBackup)
  console.log('[scpt] postinstall: saved Node 24 binary')
}

// Rebuild for Electron 33
try {
  execSync('pnpm exec electron-rebuild --version=33.4.11 --only=better-sqlite3', {
    cwd, stdio: 'inherit'
  })
  if (existsSync(nodeBin)) {
    copyFileSync(nodeBin, electronBackup)
    console.log('[scpt] postinstall: saved Electron 33 binary')
  }
  // Restore Node binary
  if (existsSync(nodeBackup)) {
    copyFileSync(nodeBackup, nodeBin)
    console.log('[scpt] postinstall: restored Node 24 binary (tests ready)')
  }
} catch (err) {
  console.error('[scpt] postinstall: Electron rebuild failed —', err.message)
}

console.log('[scpt] postinstall: done')