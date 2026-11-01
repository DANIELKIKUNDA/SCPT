const { _electron: electron } = require('playwright-core')
const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = process.cwd()
const artifactRoot = resolve(root, 'dist', 'phase13')
const userDataDir = join(artifactRoot, 'profile')
const exportDir = join(artifactRoot, 'exports')
const projectId = process.env.SCPT_PHASE13_PROJECT_ID
if (!projectId) throw new Error('SCPT_PHASE13_PROJECT_ID is required')
mkdirSync(exportDir, { recursive: true })

async function ipc(page, method, argument) {
  return page.evaluate(async ({ method, argument }) => {
    const result = argument === undefined
      ? await window.electronAPI[method]()
      : await window.electronAPI[method](argument)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.data
  }, { method, argument })
}

async function waitForTerminal(page, listMethod, projectIdValue, itemId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const items = await ipc(page, listMethod, projectIdValue)
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

async function openProjectWithRetry(page, projectIdValue) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await ipc(page, 'projectsOpen', projectIdValue)
    } catch (error) {
      lastError = error
      if (!/ENOTEMPTY|\.building-/i.test(String(error))) throw error
      await page.waitForTimeout(3000)
    }
  }
  throw lastError
}

async function main() {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [root, `--user-data-dir=${userDataDir}`, '--disable-gpu', '--disable-software-rasterizer'],
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    timeout: 180_000
  })

  try {
    const page = await app.firstWindow({ timeout: 60_000 })
    await page.getByRole('heading', { name: /Transformez vos idées/i }).waitFor({ timeout: 30_000 })
    const project = await openProjectWithRetry(page, projectId)
    const scenes = await ipc(page, 'scenesLoadSequence', projectId)
    const narration = await ipc(page, 'narrationGet', { projectId, langue: 'fr' })
    const subtitles = await ipc(page, 'subtitlesGet', { projectId, langue: 'fr' })
    const declinations = await ipc(page, 'declinaisonsList', projectId)
    const renders = await ipc(page, 'renderList', projectId)
    let exports = await ipc(page, 'finalExportList', projectId)

    const horizontal = declinations.find((item) => item.format === 'HORIZONTAL_16_9' && !item.obsolete)
    const vertical = declinations.find((item) => item.format === 'VERTICAL_9_16' && !item.obsolete)
    if (!horizontal || !vertical) throw new Error('Expected active 16:9 and 9:16 declinations')
    const completed = renders.filter((item) => item.statut === 'termine')
    const horizontalRenders = completed
      .filter((item) => item.declinaisonId === horizontal.id)
      .sort((left, right) => left.tentative - right.tentative)
    const verticalRender = completed.find((item) => item.declinaisonId === vertical.id)
    if (horizontalRenders.length < 2 || !verticalRender) throw new Error('Expected two horizontal renders and one vertical render')

    const reproducedRender = horizontalRenders.at(-1)
    let reproducedExport = exports.find((item) => item.renderJobId === reproducedRender.id)
    if (reproducedExport && !['termine', 'echoue', 'annule'].includes(reproducedExport.statut)) {
      reproducedExport = await waitForTerminal(page, 'finalExportList', projectId, reproducedExport.id, 15 * 60_000)
      exports = await ipc(page, 'finalExportList', projectId)
    } else if (!reproducedExport) {
      const requested = await ipc(page, 'finalExportStart', { projectId, renderJobId: reproducedRender.id })
      reproducedExport = await waitForTerminal(page, 'finalExportList', projectId, requested.id, 15 * 60_000)
      exports = await ipc(page, 'finalExportList', projectId)
    }
    if (reproducedExport.statut !== 'termine') throw new Error(`Reproduced export is ${reproducedExport.statut}: ${reproducedExport.diagnostic || 'sans diagnostic'}`)

    const firstHorizontalRender = horizontalRenders[0]
    const firstHorizontalExport = exports.find((item) => item.renderJobId === firstHorizontalRender.id && item.statut === 'termine')
    const verticalExport = exports.find((item) => item.renderJobId === verticalRender.id && item.statut === 'termine')
    if (!firstHorizontalExport || !verticalExport) throw new Error('Initial final exports are missing')
    if (!firstHorizontalExport.technique || !verticalExport.technique || !reproducedExport.technique) {
      throw new Error('A completed export is missing technical metadata')
    }

    const projectDir = join(userDataDir, 'projects', projectId)
    const copiedExports = [
      { format: horizontal.format, item: firstHorizontalExport, destination: join(exportDir, 'phase13-logarithmes-16x9.mp4') },
      { format: vertical.format, item: verticalExport, destination: join(exportDir, 'phase13-logarithmes-9x16.mp4') },
      { format: 'HORIZONTAL_16_9_REPRODUCTION', item: reproducedExport, destination: join(exportDir, 'phase13-logarithmes-16x9-reproduction.mp4') }
    ].map(({ format, item, destination }) => {
      copyFileSync(join(projectDir, ...item.technique.cheminFichier.split('/')), destination)
      return { format, source: item.technique.cheminFichier, destination, technique: item.technique }
    })

    await ipc(page, 'projectsClose', projectId)
    await page.waitForTimeout(3000)
    const reopened = await openProjectWithRetry(page, projectId)
    const reopenedScenes = await ipc(page, 'scenesLoadSequence', projectId)
    await ipc(page, 'projectsClose', projectId)
    if (reopenedScenes.length !== scenes.length) throw new Error('Final reopen scene count mismatch')

    const summary = {
      baseline: 'b33e6591e1a6b5b084b52c2f4f02453fdc355291',
      generatedAt: new Date().toISOString(),
      project,
      projectId,
      projectDir,
      userDataDir,
      sceneCount: scenes.length,
      scenes,
      narration,
      subtitles,
      declinations,
      renders,
      exports,
      reproduction: {
        render: reproducedRender,
        export: reproducedExport,
        samePreviewChecksum: reproducedRender.checksum === firstHorizontalRender.checksum,
        sameResolution: reproducedExport.technique.largeur === firstHorizontalExport.technique.largeur && reproducedExport.technique.hauteur === firstHorizontalExport.technique.hauteur,
        durationDeltaMs: Math.abs(reproducedExport.technique.dureeMs - firstHorizontalExport.technique.dureeMs)
      },
      persistence: { reopenedProject: reopened, reopenedSceneCount: reopenedScenes.length },
      copiedExports,
      preview: { screenshot: join(artifactRoot, 'phase13-preview.png'), sceneCountDisplayed: scenes.length }
    }
    writeFileSync(join(artifactRoot, 'phase13-evidence.json'), JSON.stringify(summary, null, 2), 'utf8')
    console.log(JSON.stringify({ projectId, sceneCount: scenes.length, reproduction: summary.reproduction, copiedExports }, null, 2))
  } finally {
    await Promise.race([app.close().catch(() => undefined), new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000))])
  }
}

main().catch((error) => {
  console.error('PHASE13_FINALIZE_FATAL', error)
  process.exitCode = 1
})
