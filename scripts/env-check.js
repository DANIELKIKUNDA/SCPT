#!/usr/bin/env node

const requiredNodeMajor = 24
const nodeVersion = process.versions.node
const nodeMajor = parseInt(nodeVersion.split('.')[0], 10)

let hasError = false

if (nodeMajor !== requiredNodeMajor) {
  console.error(`ERROR: Node.js ${requiredNodeMajor}.x required, found ${nodeVersion}`)
  hasError = true
} else {
  console.log(`Node.js ${nodeVersion} — OK`)
}

if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.error('ERROR: ELECTRON_RUN_AS_NODE=1 is set.')
  console.error('This forces Electron to run in Node.js mode instead of browser mode.')
  console.error('Remove it with: [System.Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", $null, "User")')
  hasError = true
} else {
  console.log('ELECTRON_RUN_AS_NODE — not set (OK)')
}

if (hasError) {
  process.exit(1)
} else {
  console.log('Environment check passed.')
  process.exit(0)
}