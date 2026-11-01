const { _electron: electron } = require('playwright-core')
const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = process.cwd()
const artifactRoot = resolve(root, 'dist', 'phase13')
const userDataDir = join(artifactRoot, 'profile')
const exportDir = join(artifactRoot, 'exports')
mkdirSync(userDataDir, { recursive: true })
mkdirSync(exportDir, { recursive: true })

const scenes = [
  { type: 'texte', titre: 'Les logarithmes', texteAffiche: 'Comprendre une nouvelle façon de lire les puissances', narrationTexte: 'Dans cette leçon, nous allons comprendre les logarithmes comme une autre manière de lire les puissances.' },
  { type: 'texte', titre: 'Rappel : les puissances', texteAffiche: '2³ = 8 signifie que 2 × 2 × 2 = 8', narrationTexte: 'Commençons par un rappel. Deux puissance trois vaut huit, car on multiplie trois fois le nombre deux.' },
  { type: 'formule', titre: 'Définition', texteAffiche: String.raw`\log_a(x)=y \iff a^y=x`, narrationTexte: 'Le logarithme de x en base a est le nombre y tel que a puissance y soit égal à x.' },
  { type: 'formule', titre: 'Conditions d’existence', texteAffiche: String.raw`a>0,\quad a\neq 1,\quad x>0`, narrationTexte: 'Cette définition exige une base strictement positive et différente de un, ainsi qu’un argument x strictement positif.' },
  { type: 'formule', titre: 'Produit et quotient', texteAffiche: String.raw`\log_a(xy)=\log_a(x)+\log_a(y)\\[8pt]\log_a\!\left(\frac{x}{y}\right)=\log_a(x)-\log_a(y)`, narrationTexte: 'Le logarithme transforme un produit en somme et un quotient en différence.' },
  { type: 'formule', titre: 'Puissance', texteAffiche: String.raw`\log_a(x^n)=n\,\log_a(x)`, narrationTexte: 'Lorsqu’un argument est élevé à une puissance n, cet exposant devient un facteur devant le logarithme.' },
  { type: 'texte', titre: 'Exemple numérique', texteAffiche: 'log₂(8) = 3, car 2³ = 8', narrationTexte: 'Par exemple, logarithme de huit en base deux vaut trois, puisque deux puissance trois vaut huit.' },
  { type: 'diagramme', titre: 'La courbe de f(x) = log₂(x)', texteAffiche: '@line\n0.25: -2\n0.5: -1\n1: 0\n2: 1\n4: 2\n8: 3', narrationTexte: 'La courbe de logarithme en base deux est définie seulement pour x positif. Elle passe par un, zéro, puis augmente lentement.' },
  { type: 'formule', titre: 'Application guidée', texteAffiche: String.raw`\log_2(32)=?\quad 2^5=32\quad\Longrightarrow\quad\log_2(32)=5`, narrationTexte: 'Cherchons logarithme de trente-deux en base deux. Comme deux puissance cinq vaut trente-deux, la réponse est cinq.' },
  { type: 'texte', titre: 'À retenir', texteAffiche: 'Le logarithme répond à la question : quel exposant ?', narrationTexte: 'Retenons que le logarithme répond à la question : quel exposant faut-il donner à la base pour obtenir le nombre étudié ?' }
]

function now() { return Date.now() }
function elapsed(start) { return Math.round((Date.now() - start) / 100) / 10 }
async function ipc(page, method, argument) {
  return page.evaluate(async ({ method, argument }) => {
    const api = window.electronAPI
    const result = argument === undefined ? await api[method]() : await api[method](argument)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.data
  }, { method, argument })
}

async function waitForTerminal(page, listMethod, projectId, itemId, timeoutMs) {
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    const items = await ipc(page, listMethod, projectId)
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) throw new Error(`${listMethod}: item ${itemId} disappeared`)
    if (item.statut === 'termine') return item
    if (item.statut === 'echoue' || item.statut === 'annule') {
      throw new Error(`${listMethod}: ${item.statut}: ${item.diagnostic || 'sans diagnostic'}`)
    }
    await page.waitForTimeout(2000)
  }
  throw new Error(`${listMethod}: timeout after ${timeoutMs}ms`)
}

async function main() {
  const startedAt = now()
  const timings = {}
  const consoleErrors = []
  const pageErrors = []
  const mainFatalErrors = []
  const electronPath = require('electron')
  console.log(`[PHASE13] launching Electron with profile ${userDataDir}`)
  const app = await electron.launch({
    executablePath: electronPath,
    args: [root, `--user-data-dir=${userDataDir}`, '--disable-gpu', '--disable-software-rasterizer'],
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    timeout: 180_000
  })
  console.log('[PHASE13] Electron transport connected')
  const processHandle = app.process()
  processHandle.stderr?.on('data', (chunk) => {
    const message = chunk.toString()
    process.stderr.write(`[MAIN-ERR] ${message}`)
    if (/unhandled|uncaught|fatal/i.test(message)) mainFatalErrors.push(message.trim())
  })

  let projectId
  try {
    const page = await app.firstWindow({ timeout: 60_000 })
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    await page.getByRole('heading', { name: /Transformez vos idées/i }).waitFor({ timeout: 30_000 })

    const creationStart = now()
    const project = await ipc(page, 'projectsCreate', {
      titre: 'SCPT — Prototype Phase 13 — Les logarithmes',
      type: 'vidéo pédagogique',
      objectif: 'Comprendre la définition, les conditions et les propriétés essentielles des logarithmes',
      publicCible: 'Élèves du secondaire',
      langueSource: 'fr'
    })
    projectId = project.id
    await ipc(page, 'projectsOpen', projectId)

    const createdScenes = []
    for (const scene of scenes) {
      createdScenes.push(await ipc(page, 'scenesCreate', { projetId: projectId, ...scene, dureeMs: 5000 }))
    }

    const narrationText = scenes.map((scene) => scene.narrationTexte).join('\n\n')
    const narration = await ipc(page, 'narrationGenerate', {
      projectId,
      langue: 'fr',
      texte: narrationText,
      voixId: 'fr_FR-siwis-medium'
    })
    const generatedTake = narration.prises.at(-1)
    if (!generatedTake) throw new Error('Piper did not create a narration take')
    const finalNarration = await ipc(page, 'narrationSelectFinal', { projectId, takeId: generatedTake.id })

    const baseDuration = Math.floor(generatedTake.dureeMs / createdScenes.length)
    let assigned = 0
    for (let index = 0; index < createdScenes.length; index += 1) {
      const duration = index === createdScenes.length - 1 ? generatedTake.dureeMs - assigned : baseDuration
      assigned += duration
      await ipc(page, 'scenesUpdate', {
        sceneId: createdScenes[index].id,
        projetId: projectId,
        dureeMs: duration,
        composition: createdScenes[index].composition,
        transition: createdScenes[index].transition
      })
    }

    const subtitles = await ipc(page, 'subtitlesSynchronize', { projectId, langue: 'fr' })
    const validatedSubtitles = await ipc(page, 'subtitlesValidate', projectId)

    const declinations = []
    for (const format of ['HORIZONTAL_16_9', 'VERTICAL_9_16']) {
      let value = await ipc(page, 'declinaisonsCreate', { projectId, format, langue: 'fr', profilExport: 'MVP_PREMIUM' })
      value = await ipc(page, 'declinaisonsValidate', { projectId, declinaisonId: value.id })
      value = await ipc(page, 'declinaisonsMarkReady', { projectId, declinaisonId: value.id })
      declinations.push(value)
    }
    timings.creationSeconds = elapsed(creationStart)

    const previewStart = now()
    await ipc(page, 'projectsClose', projectId)
    await page.reload({ waitUntil: 'domcontentloaded' })
    const projectRow = page.locator('.project-item').filter({ hasText: project.titre }).last()
    await projectRow.getByRole('button', { name: /Ouvrir/i }).click()
    const previewPanel = page.locator('.preview-panel')
    await previewPanel.waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('.scene-count').getByText(`${scenes.length} scènes`, { exact: true }).waitFor({ timeout: 30_000 })
    const previewScreenshot = join(artifactRoot, 'phase13-preview.png')
    await previewPanel.screenshot({ path: previewScreenshot })
    timings.previewSeconds = elapsed(previewStart)

    const renderResults = []
    for (const declination of declinations) {
      const renderStart = now()
      const requested = await ipc(page, 'renderStart', { projectId, declinaisonId: declination.id })
      const completed = await waitForTerminal(page, 'renderList', projectId, requested.id, 45 * 60_000)
      timings[`render_${declination.format}_seconds`] = elapsed(renderStart)
      renderResults.push(completed)
    }

    const exportResults = []
    for (const render of renderResults) {
      const exportStart = now()
      const requested = await ipc(page, 'finalExportStart', { projectId, renderJobId: render.id })
      const completed = await waitForTerminal(page, 'finalExportList', projectId, requested.id, 15 * 60_000)
      timings[`export_${completed.declinaisonId}_seconds`] = elapsed(exportStart)
      exportResults.push(completed)
    }

    const closeStart = now()
    await ipc(page, 'projectsClose', projectId)
    const reopened = await ipc(page, 'projectsOpen', projectId)
    const reopenedScenes = await ipc(page, 'scenesLoadSequence', projectId)
    const reopenedNarration = await ipc(page, 'narrationGet', { projectId, langue: 'fr' })
    const reopenedSubtitles = await ipc(page, 'subtitlesGet', { projectId, langue: 'fr' })
    const reopenedDeclinations = await ipc(page, 'declinaisonsList', projectId)
    timings.reopenSeconds = elapsed(closeStart)

    if (reopenedScenes.length !== scenes.length) throw new Error(`Reopen scene count mismatch: ${reopenedScenes.length}`)
    if (reopenedScenes.map((scene) => scene.titre).join('|') !== scenes.map((scene) => scene.titre).join('|')) throw new Error('Reopen scene titles mismatch')
    if (reopenedNarration.priseFinaleId !== finalNarration.priseFinaleId) throw new Error('Reopen narration mismatch')
    if (reopenedSubtitles.statut !== 'validee' || reopenedSubtitles.segments.length !== validatedSubtitles.segments.length) throw new Error('Reopen subtitles mismatch')
    if (reopenedDeclinations.filter((item) => item.pretPourRendu && !item.obsolete).length !== 2) throw new Error('Reopen declinations mismatch')

    const reproductionStart = now()
    const reproducedRenderRequest = await ipc(page, 'renderStart', { projectId, declinaisonId: declinations[0].id })
    const reproducedRender = await waitForTerminal(page, 'renderList', projectId, reproducedRenderRequest.id, 45 * 60_000)
    const reproducedExportRequest = await ipc(page, 'finalExportStart', { projectId, renderJobId: reproducedRender.id })
    const reproducedExport = await waitForTerminal(page, 'finalExportList', projectId, reproducedExportRequest.id, 15 * 60_000)
    timings.reproductionSeconds = elapsed(reproductionStart)

    const projectDir = join(userDataDir, 'projects', projectId)
    const copiedExports = exportResults.map((item) => {
      const format = declinations.find((declination) => declination.id === item.declinaisonId).format
      const destination = join(exportDir, format === 'HORIZONTAL_16_9' ? 'phase13-logarithmes-16x9.mp4' : 'phase13-logarithmes-9x16.mp4')
      copyFileSync(join(projectDir, ...item.technique.cheminFichier.split('/')), destination)
      return { format, source: item.technique.cheminFichier, destination, technique: item.technique }
    })

    const summary = {
      baseline: 'b33e6591e1a6b5b084b52c2f4f02453fdc355291',
      generatedAt: new Date().toISOString(),
      project: reopened,
      projectId,
      projectDir,
      userDataDir,
      sceneCount: reopenedScenes.length,
      scenes: reopenedScenes,
      narration: { takeId: generatedTake.id, durationMs: generatedTake.dureeMs, checksum: generatedTake.checksum, status: finalNarration.statut },
      subtitles: { status: reopenedSubtitles.statut, count: reopenedSubtitles.segments.length, segments: reopenedSubtitles.segments },
      declinations: reopenedDeclinations,
      renders: renderResults,
      exports: exportResults,
      reproduction: {
        render: reproducedRender,
        export: reproducedExport,
        sameResolution: reproducedExport.technique.largeur === exportResults[0].technique.largeur && reproducedExport.technique.hauteur === exportResults[0].technique.hauteur,
        durationDeltaMs: Math.abs(reproducedExport.technique.dureeMs - exportResults[0].technique.dureeMs)
      },
      copiedExports,
      preview: { screenshot: previewScreenshot, sceneCountDisplayed: scenes.length },
      timings: { ...timings, totalSeconds: elapsed(startedAt) },
      errors: { consoleErrors, pageErrors, mainFatalErrors }
    }
    writeFileSync(join(artifactRoot, 'phase13-evidence.json'), JSON.stringify(summary, null, 2), 'utf8')
    await ipc(page, 'projectsClose', projectId)
    if (consoleErrors.length || pageErrors.length || mainFatalErrors.length) throw new Error(JSON.stringify(summary.errors))
    console.log(JSON.stringify({ projectId, sceneCount: reopenedScenes.length, timings: summary.timings, copiedExports }, null, 2))
  } finally {
    await app.close().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('PHASE13_FATAL', error)
  process.exitCode = 1
})
