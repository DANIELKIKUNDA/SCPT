import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const swapScript = resolve(root, 'scripts', 'swap-sqlite-binary.mjs')
const scenario = resolve(root, 'scripts', 'phase13-prototype-e2e.cjs')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
}

if (!existsSync(scenario)) throw new Error('Phase 13 scenario is missing')

try {
  run(process.execPath, [swapScript, 'electron'])
  if (process.env.SCPT_PHASE13_SKIP_BUILD !== '1') {
    run(process.execPath, [resolve(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])
  }
  run(process.execPath, [scenario])
} finally {
  run(process.execPath, [swapScript, 'node'])
}
