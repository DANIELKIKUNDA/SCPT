// SCPT Phase 2 — Swap better-sqlite3 native binary between Node 24 (tests)
// and Electron 33 (runtime).
//
// WHY: Electron 33.4.11 embeds Node 20.18.3 (ABI 130). Tests run under Node 24
// (ABI 137). better-sqlite3 is not purely N-API; its compiled .node embeds
// NODE_MODULE_VERSION, so a binary built for one ABI won't load under the other.
//
// postinstall.mjs produces and caches both binaries:
//   build/Release/better_sqlite3.node.node24
//   build/Release/better_sqlite3.node.electron33
//
// This script copies the requested variant onto the active
// build/Release/better_sqlite3.node slot so the right binary is loaded at runtime.
//
// Usage:
//   node scripts/swap-sqlite-binary.mjs node       # tests / Node 24 (ABI 137)
//   node scripts/swap-sqlite-binary.mjs electron   # dev / Electron 33 (ABI 130)

import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const target = process.argv[2]

function findPkgDir() {
  try {
    return dirname(dirname(require.resolve('better-sqlite3', { paths: [process.cwd()] })))
  } catch {
    return null
  }
}

const pkgDir = findPkgDir()
if (!pkgDir) {
  console.log('[scpt] swap: better-sqlite3 not found; nothing to do')
  process.exit(0)
}

const releaseDir = join(pkgDir, 'build', 'Release')
const active = join(releaseDir, 'better_sqlite3.node')
const nodeBin = join(releaseDir, 'better_sqlite3.node.node24')
const electronBin = join(releaseDir, 'better_sqlite3.node.electron33')

if (target === 'electron') {
  if (!existsSync(electronBin)) {
    console.error('[scpt] swap: electron33 binary missing. Run `pnpm install` to rebuild it.')
    process.exit(1)
  }
  copyFileSync(electronBin, active)
  console.log('[scpt] swap: better-sqlite3 → Electron 33 (ABI 130)')
} else if (target === 'node') {
  if (!existsSync(nodeBin)) {
    console.error('[scpt] swap: node24 binary missing. Run `pnpm install` to rebuild it.')
    process.exit(1)
  }
  copyFileSync(nodeBin, active)
  console.log('[scpt] swap: better-sqlite3 → Node 24 (ABI 137)')
} else {
  console.error('[scpt] swap: usage: node scripts/swap-sqlite-binary.mjs <node|electron>')
  process.exit(1)
}
