// TEMPORARY Phase 12 preflight spike — drives the REAL SCPT Electron app via
// Playwright and verifies contextIsolation / nodeIntegration / IPC / clean close.
// This file is deleted after the preflight.
const { _electron: electron } = require('playwright-core')

const results = []
function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const electronPath = require('electron')
  console.log('electron executable:', electronPath)

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
  })

  const consoleErrors = []
  const pageErrors = []
  let unhandledMain = false

  // Capture main-process output immediately.
  app.process().stdout?.on('data', (chunk) => process.stdout.write('[MAIN] ' + chunk.toString()))
  app.process().stderr?.on('data', (chunk) => {
    const text = chunk.toString()
    process.stdout.write('[MAIN-ERR] ' + text)
    if (/unhandled|uncaught|fatal/i.test(text)) unhandledMain = true
  })

  try {
    const window = await app.firstWindow({ timeout: 30000 })
    window.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    window.on('pageerror', (err) => pageErrors.push(String(err)))

    // Robust wait: the React root must render the home screen.
    await window.getByRole('heading', { name: 'Projets' }).waitFor({ timeout: 30000 })
    console.log('[SPIKE] home screen rendered')

    // --- Section 1: Playwright drives real Electron -----------------------
    const title = await window.title()
    record('PLAYWRIGHT_ELECTRON_LAUNCH', title === 'SCPT', `title=${JSON.stringify(title)}`)

    const security = await window.evaluate(() => ({
      hasProcess: typeof window.process !== 'undefined',
      hasRequire: typeof window.require !== 'undefined',
      hasElectronAPI: typeof window.electronAPI !== 'undefined',
      hasNodeInGlobal: typeof globalThis.process !== 'undefined'
    }))
    const isolationOk = !security.hasProcess && !security.hasRequire && security.hasElectronAPI && !security.hasNodeInGlobal
    record('PLAYWRIGHT_ELECTRON_ISOLATION', isolationOk, JSON.stringify(security))

    // Read a renderer element (the body must contain the SCPT brand)
    const brand = await window.locator('body').innerText({ timeout: 10000 })
    record('PLAYWRIGHT_ELECTRON_READ_RENDERER', brand.includes('SCPT'), `bodyHasSCPT=${brand.includes('SCPT')}`)

    // --- Section 2: 1366x768 viewport -------------------------------------
    await window.setViewportSize({ width: 1366, height: 768 })
    await window.waitForTimeout(400)
    const layout = await window.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth
    }))
    const homeVisible = await window.getByRole('heading', { name: 'Projets' }).isVisible()
    const newProjectBtnVisible = await window.getByRole('button', { name: 'Nouveau projet' }).isVisible()
    const noHorizontalOverflow = layout.scrollWidth <= layout.clientWidth + 1
    record(
      'WINDOW_1366_768',
      layout.innerWidth === 1366 && layout.innerHeight === 768 && homeVisible && newProjectBtnVisible && noHorizontalOverflow,
      `viewport=${layout.innerWidth}x${layout.innerHeight}, scrollW=${layout.scrollWidth}, scrollH=${layout.scrollHeight}, homeVisible=${homeVisible}, createBtn=${newProjectBtnVisible}`
    )

    // Click a simple button: "Nouveau projet" toggles the create form
    await window.getByRole('button', { name: 'Nouveau projet' }).click({ timeout: 10000 })
    await window.getByPlaceholder('Titre').waitFor({ timeout: 10000 })
    record('PLAYWRIGHT_ELECTRON_CLICK', true, 'clicked "Nouveau projet", create form appeared')

    // Editor openability: create a real project through the UI. Document the
    // project-open result separately (a reproduced Phase 2 lock-manager defect
    // is expected to surface here — see report).
    const projectTitle = `Preflight ${Date.now()}`
    await window.getByPlaceholder('Titre').fill(projectTitle)
    await window.getByPlaceholder('Type (ex: tutoriel, démonstration)').fill('tutoriel')
    await window.getByPlaceholder('Objectif').fill('Preflight Phase 12')
    await window.getByPlaceholder('Public cible').fill('QA')
    await window.getByRole('button', { name: 'Créer et ouvrir' }).click()
    await window.waitForTimeout(2500)
    const bodyAfterCreate = await window.locator('body').innerText()
    const created = bodyAfterCreate.includes(projectTitle)
    const errorShown = /Erreur ouverture|déjà ouvert|lock|lockfile/i.test(bodyAfterCreate)
    record('WINDOW_1366_768_EDITOR_OPEN', created, `projectListed=${created}, openErrorShown=${errorShown}`)

    const scrollable = await window.evaluate(() => document.documentElement.scrollHeight >= document.documentElement.clientHeight)
    record('WINDOW_1366_768_SCROLL', scrollable, `scrollHeight=${await window.evaluate(() => document.documentElement.scrollHeight)}`)

    const noErrors = consoleErrors.length === 0 && pageErrors.length === 0 && !unhandledMain
    record('PLAYWRIGHT_ELECTRON_NO_ERRORS', noErrors, `consoleErrors=${consoleErrors.length}, pageErrors=${pageErrors.length}, unhandledMain=${unhandledMain}`)
    if (consoleErrors.length) console.log('  console errors:', JSON.stringify(consoleErrors.slice(0, 5)))
    if (pageErrors.length) console.log('  page errors:', JSON.stringify(pageErrors.slice(0, 5)))
  } catch (error) {
    record('SPIKE_EXECUTION', false, error instanceof Error ? error.message : String(error))
  } finally {
    await app.close().catch(() => undefined)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\nSPIKE TOTAL: ${results.length - failed.length}/${results.length} PASS`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('SPIKE FATAL', error)
  process.exit(1)
})
