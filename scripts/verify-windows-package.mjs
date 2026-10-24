import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const failures = []
const checks = []
const check = (condition, label) => {
  checks.push({ condition, label })
  if (!condition) failures.push(label)
}

check(pkg.build?.appId === 'com.scpt.app', 'appId stable: com.scpt.app')
check(pkg.build?.productName === 'SCPT', 'productName stable: SCPT')
check(pkg.build?.win?.icon === 'build/icon.ico', 'official Windows icon configured')
check(pkg.build?.nsis?.installerIcon === 'build/icon.ico', 'NSIS installer icon configured')
check(pkg.build?.nsis?.uninstallerIcon === 'build/icon.ico', 'NSIS uninstaller icon configured')
check(existsSync(join(root, 'build', 'icon.ico')), 'Windows multi-resolution icon exists')
check(existsSync(join(root, 'build', 'icon.png')), 'Electron PNG icon exists')
check(pkg.build?.npmRebuild === false, 'npmRebuild remains false (native ABI swap strategy)')
check(pkg.build?.win?.target?.[0]?.target === 'nsis', 'Windows target is NSIS')
check(pkg.build?.win?.target?.[0]?.arch?.includes('x64'), 'Windows target explicitly includes x64')
check(pkg.build?.nsis?.oneClick === false, 'NSIS assisted installer (oneClick=false)')
check(pkg.build?.nsis?.perMachine === false, 'NSIS installs per-user without mandatory admin rights')
check(pkg.build?.nsis?.allowToChangeInstallationDirectory === true, 'Install directory can be changed')
check(pkg.build?.nsis?.deleteAppDataOnUninstall === false, 'Uninstall preserves user data/projects')
check(pkg.build?.nsis?.runAfterFinish === false, 'Installer does not auto-launch before certification')
check(pkg.build?.nsis?.createStartMenuShortcut === true, 'Start menu shortcut enabled')
check(pkg.build?.nsis?.createDesktopShortcut === 'always', 'Desktop shortcut enabled')

const version = pkg.version
const setup = join(root, 'dist', `SCPT Setup ${version}.exe`)
if (process.argv.includes('--artifacts')) {
  check(existsSync(setup), `installer exists: dist/SCPT Setup ${version}.exe`)
  if (existsSync(setup)) check(statSync(setup).size > 0, 'installer is non-empty')
  check(existsSync(`${setup}.blockmap`), `blockmap exists: dist/SCPT Setup ${version}.exe.blockmap`)
  check(existsSync(join(root, 'dist', 'win-unpacked', 'SCPT.exe')), 'portable packaged executable exists')
}

for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'}  ${item.label}`)
if (failures.length) {
  console.error(`\nWindows package verification failed (${failures.length} gate(s)).`)
  process.exit(1)
}
console.log(`\nWindows package configuration verified (${checks.length}/${checks.length}).`)
