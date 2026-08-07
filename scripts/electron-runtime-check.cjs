// SCPT Phase 0 — Electron Runtime Diagnostic
// Execute with: node_modules\electron\dist\electron.exe scripts\electron-runtime-check.cjs

var electron = require('electron')

console.log('=== ELECTRON RUNTIME DIAGNOSTIC ===')
console.log('process.execPath:', process.execPath)
console.log('process.argv:', JSON.stringify(process.argv))
console.log('process.type:', process.type)
console.log('process.versions.node:', process.versions.node)
console.log('process.versions.electron:', process.versions.electron)
console.log('process.env.ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE)
console.log('typeof electron:', typeof electron)
console.log('typeof electron.app:', typeof electron.app)
console.log('typeof electron.BrowserWindow:', typeof electron.BrowserWindow)
console.log('=== END ===')

if (process.versions.electron && typeof electron.app !== 'undefined') {
  console.log('RESULT: Electron runtime is OK')
} else {
  console.log('RESULT: Electron runtime is BROKEN — require("electron") resolved npm stub')
}

process.exit(0)