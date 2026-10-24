/**
 * SCPT Phase 12 — real Electron end-to-end certification.
 *
 * Drives the built desktop application through Playwright's Electron transport.
 * The suite uses an isolated Electron userData directory so it never touches a
 * user's real SCPT catalogue, preferences, projects or recovery data.
 */
const { _electron: electron } = require('playwright-core')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const results = []
const testRunId = Date.now()
const userDataDir = mkdtempSync(join(tmpdir(), 'scpt-phase12-e2e-'))

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function assertStep(name, fn) {
  try {
    const detail = await fn()
    record(name, true, typeof detail === 'string' ? detail : '')
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  const packagedExecutable = process.env.SCPT_E2E_EXECUTABLE
  const electronPath = packagedExecutable || require('electron')
  console.log(`[E2E] launching ${electronPath}`)
  const app = await electron.launch({
    executablePath: electronPath,
    args: [
      ...(packagedExecutable ? [] : [process.cwd()]),
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--disable-software-rasterizer'
    ],
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    timeout: 90_000
  })
  console.log('[E2E] Electron transport connected')
  const electronProcess = app.process()

  const consoleErrors = []
  const pageErrors = []
  const mainFatalErrors = []
  electronProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString()
    process.stderr.write(`[MAIN-ERR] ${text}`)
    if (/unhandled|uncaught|fatal/i.test(text)) mainFatalErrors.push(text.trim())
  })

  try {
    const window = await app.firstWindow({ timeout: 30_000 })
    window.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
    window.on('pageerror', (error) => pageErrors.push(String(error)))

    await assertStep('E2E_01_REAL_ELECTRON_LAUNCH', async () => {
      await window.getByRole('heading', { name: /Transformez vos idées/i }).waitFor({ timeout: 30_000 })
      const title = await window.title()
      if (title !== 'SCPT') throw new Error(`Titre inattendu: ${JSON.stringify(title)}`)
      return `title=${title}`
    })

    await assertStep('E2E_02_SECURITY_BOUNDARY', async () => {
      const security = await window.evaluate(() => ({
        process: typeof window.process,
        require: typeof window.require,
        electronAPI: typeof window.electronAPI
      }))
      if (security.process !== 'undefined' || security.require !== 'undefined' || security.electronAPI !== 'object') {
        throw new Error(JSON.stringify(security))
      }
      return JSON.stringify(security)
    })

    await assertStep('E2E_03_1366_768_NO_HORIZONTAL_OVERFLOW', async () => {
      await window.setViewportSize({ width: 1366, height: 768 })
      await window.waitForTimeout(250)
      const layout = await window.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      if (layout.width !== 1366 || layout.height !== 768 || layout.scrollWidth > layout.clientWidth + 1) {
        throw new Error(JSON.stringify(layout))
      }
      return JSON.stringify(layout)
    })

    await assertStep('E2E_04_CREATE_AND_OPEN_PROJECT', async () => {
      await window.getByRole('button', { name: 'Nouveau projet' }).first().click()
      const title = `E2E Phase 12 ${testRunId}`
      await window.getByPlaceholder('Ex. Comprendre les logarithmes').fill(title)
      await window.getByPlaceholder('Cours, démonstration, publicité…').fill('démonstration')
      await window.getByPlaceholder('Quel résultat voulez-vous obtenir ?').fill('Valider le parcours Electron réel')
      await window.getByPlaceholder('Ex. Élèves de 4e secondaire').fill('Certification Phase 12')
      await window.getByRole('button', { name: /Créer et ouvrir/ }).click()
      await window.getByText(title, { exact: true }).waitFor({ timeout: 20_000 })
      await window.getByRole('region', { name: 'Liste des scènes' }).waitFor({ timeout: 20_000 })
      return title
    })

    await assertStep('E2E_05_CREATE_SCENE', async () => {
      await window.getByRole('button', { name: 'Nouvelle scène' }).click()
      await window.getByText('Scènes (1)', { exact: true }).waitFor({ timeout: 15_000 })
      await window.getByPlaceholder('Titre de la scène').waitFor({ timeout: 10_000 })
      return 'sceneCount=1'
    })

    const sceneTitle = `Scène certifiée ${testRunId}`
    await assertStep('E2E_06_EDIT_AND_SAVE_SCENE', async () => {
      const titleInput = window.getByPlaceholder('Titre de la scène')
      await titleInput.fill(sceneTitle)
      await window.getByPlaceholder('Texte visible à l’écran').fill('SCPT Phase 12 — contenu E2E persistant')
      await window.getByPlaceholder('Texte destiné à la narration').fill('Cette narration valide la sauvegarde réelle de la scène.')
      await window.getByRole('button', { name: /Sauvegarder/ }).click()
      await window.getByText('Sauvegardé', { exact: true }).waitFor({ timeout: 15_000 })
      return sceneTitle
    })

    await assertStep('E2E_07_PRODUCTION_TABS_AND_KEYBOARD', async () => {
      const narration = window.getByRole('tab', { name: 'Narration' })
      await narration.focus()
      await window.keyboard.press('ArrowRight')
      const subtitles = window.getByRole('tab', { name: 'Sous-titres' })
      if ((await subtitles.getAttribute('aria-selected')) !== 'true') throw new Error('ArrowRight did not select Sous-titres')
      await window.keyboard.press('End')
      const reliability = window.getByRole('tab', { name: 'Fiabilité' })
      if ((await reliability.getAttribute('aria-selected')) !== 'true') throw new Error('End did not select Fiabilité')
      await window.keyboard.press('Home')
      if ((await narration.getAttribute('aria-selected')) !== 'true') throw new Error('Home did not return to Narration')
      return 'ArrowRight/End/Home OK'
    })

    await assertStep('E2E_08_ALL_STUDIO_TOOLS_OPEN', async () => {
      const tabs = ['Narration', 'Sous-titres', 'Médias', 'Formats', 'Rendus', 'Export final', 'Fiabilité']
      for (const name of tabs) {
        const tab = window.getByRole('tab', { name })
        await tab.click()
        if ((await tab.getAttribute('aria-selected')) !== 'true') throw new Error(`${name} non sélectionné`)
        const panel = window.getByRole('tabpanel')
        await panel.waitFor({ state: 'visible', timeout: 10_000 })
      }
      return `${tabs.length}/7 outils ouverts`
    })

    await assertStep('E2E_09_CLOSE_REOPEN_PERSISTENCE', async () => {
      await window.getByRole('button', { name: /Projets/ }).first().click()
      await window.getByRole('heading', { name: 'Vos projets' }).waitFor({ timeout: 20_000 }).catch(async () => {
        await window.getByText('Projets récents').waitFor({ timeout: 20_000 })
      })
      const projectCard = window.getByText(`E2E Phase 12 ${testRunId}`, { exact: true })
      await projectCard.waitFor({ timeout: 15_000 })
      const card = projectCard.locator('xpath=ancestor::li[contains(@class,"project-item")]')
      await card.getByRole('button', { name: /Ouvrir/ }).click()
      await window.getByPlaceholder('Titre de la scène').waitFor({ timeout: 20_000 })
      const persistedTitle = await window.getByPlaceholder('Titre de la scène').inputValue()
      if (persistedTitle !== sceneTitle) throw new Error(`Titre persistant inattendu: ${persistedTitle}`)
      return `persisted=${persistedTitle}`
    })

    await assertStep('E2E_10_CTRL_S_SHORTCUT', async () => {
      await window.getByPlaceholder('Titre de la scène').fill(`${sceneTitle} CtrlS`)
      await window.keyboard.press('Control+S')
      await window.getByText('Sauvegardé', { exact: true }).waitFor({ timeout: 15_000 })
      return 'Ctrl+S OK'
    })

    await assertStep('E2E_11_RENDERER_AND_MAIN_NO_FATAL_ERRORS', async () => {
      if (consoleErrors.length || pageErrors.length || mainFatalErrors.length) {
        throw new Error(JSON.stringify({
          consoleErrors,
          pageErrors,
          mainFatalErrors
        }))
      }
      return '0 renderer/page/main fatal errors'
    })
  } finally {
    await app.close().catch(() => undefined)
  }

  await new Promise((resolve) => setTimeout(resolve, 300))
  record('E2E_12_CLEAN_ELECTRON_CLOSE', electronProcess.exitCode !== null, `exitCode=${electronProcess.exitCode}`)

  const failed = results.filter((item) => !item.pass)
  console.log(`\nSCPT PHASE 12 ELECTRON E2E: ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) {
    console.log('Failed gates:', failed.map((item) => item.name).join(', '))
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('E2E FATAL', error)
    process.exitCode = 1
  })
  .finally(() => {
    try { rmSync(userDataDir, { recursive: true, force: true }) } catch { /* best effort */ }
  })
