import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const swapScript = resolve(root, 'scripts', 'swap-sqlite-binary.mjs')
const scenario = resolve(root, 'scripts', 'phase13-finalize-e2e.cjs')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
}

try {
  run(process.execPath, [swapScript, 'electron'])
  run(process.execPath, [scenario])
} finally {
  run(process.execPath, [swapScript, 'node'])
}
