import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
}

let failed = null
try {
  run(process.execPath, ['scripts/swap-sqlite-binary.mjs', 'electron'])
  if (process.env['SCPT_E2E_SKIP_BUILD'] !== '1') {
    run(process.execPath, ['node_modules/electron-vite/bin/electron-vite.js', 'build'])
  }
  run(process.execPath, ['scripts/phase12-electron-e2e.cjs'])
} catch (error) {
  failed = error
} finally {
  try {
    run(process.execPath, ['scripts/swap-sqlite-binary.mjs', 'node'])
  } catch (restoreError) {
    if (!failed) failed = restoreError
    else console.error('Additionally failed to restore Node better-sqlite3 binary:', restoreError)
  }
}

if (failed) {
  console.error(failed instanceof Error ? failed.message : String(failed))
  process.exit(1)
}
