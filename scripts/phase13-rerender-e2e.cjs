const { _electron: electron } = require('playwright-core')
const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = process.cwd()
const artifactRoot = resolve(root, 'dist', 'phase13')
const userDataDir = join(artifactRoot, 'profile')
const exportDir = join(artifactRoot, 'exports')
const projectId = process.env.SCPT_PHASE13_PROJECT_ID
const mode = process.env.SCPT_PHASE13_RERENDER_MODE || 'primary'
if (!projectId || !['primary', 'reproduction'].includes(mode)) throw new Error('Invalid Phase 13 rerender configuration')
mkdirSync(exportDir, { recursive: true })

async function ipc(page, method, argument) {
  return page.evaluate(async ({ method, argument }) => {
    const result = argument === undefined ? await window.electronAPI[method]() : await window.electronAPI[method](argument)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.data
  }, { method, argument })
}

async function waitForTerminal(page, listMethod, itemId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const items = await ipc(page, listMethod, projectId)
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) throw new Error(`${listMethod}: item ${itemId} disappeared`)
    if (item.statut === 'termine') return item
    if (item.statut === 'echoue' || item.statut === 'annule') throw new Error(`${listMethod}: ${item.statut}: ${item.diagnostic || 'sans diagnostic'}`)
    await page.waitForTimeout(2000)
  }
  throw new Error(`${listMethod}: timeout after ${timeoutMs}ms`)
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
    await ipc(page, 'projectsOpen', projectId)
    const scenes = await ipc(page, 'scenesLoadSequence', projectId)
    if (scenes.length !== 10) throw new Error(`Expected 10 scenes, got ${scenes.length}`)
    const declinations = (await ipc(page, 'declinaisonsList', projectId)).filter((item) => !item.obsolete)
    const targets = mode === 'primary'
      ? ['HORIZONTAL_16_9', 'VERTICAL_9_16']
      : ['HORIZONTAL_16_9']
    const results = []

    for (const format of targets) {
      const declination = declinations.find((item) => item.format === format)
      if (!declination) throw new Error(`Missing ${format} declination`)
      const renderRequest = await ipc(page, 'renderStart', { projectId, declinaisonId: declination.id })
      const render = await waitForTerminal(page, 'renderList', renderRequest.id, 45 * 60_000)
      const exportRequest = await ipc(page, 'finalExportStart', { projectId, renderJobId: render.id })
      const finalExport = await waitForTerminal(page, 'finalExportList', exportRequest.id, 15 * 60_000)
      if (!finalExport.technique) throw new Error(`Missing technical metadata for ${format}`)
      results.push({ format, render, export: finalExport })
    }

    const projectDir = join(userDataDir, 'projects', projectId)
    for (const result of results) {
      const suffix = mode === 'reproduction' ? '16x9-reproduction' : result.format === 'HORIZONTAL_16_9' ? '16x9' : '9x16'
      const destination = join(exportDir, `phase13-logarithmes-${suffix}.mp4`)
      copyFileSync(join(projectDir, ...result.export.technique.cheminFichier.split('/')), destination)
      result.destination = destination
    }

    const primaryPath = join(artifactRoot, 'phase13-fixed-primary.json')
    if (mode === 'primary') {
      writeFileSync(primaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), projectId, sceneCount: scenes.length, results }, null, 2), 'utf8')
    } else {
      if (!existsSync(primaryPath)) throw new Error('Primary corrected evidence is missing')
      const primary = JSON.parse(readFileSync(primaryPath, 'utf8'))
      const original = primary.results.find((item) => item.format === 'HORIZONTAL_16_9')
      const reproduced = results[0]
      const evidencePath = join(artifactRoot, 'phase13-evidence.json')
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
      evidence.correctedRenders = primary.results
      evidence.correctedReproduction = {
        ...reproduced,
        samePreviewChecksum: reproduced.render.checksum === original.render.checksum,
        sameFinalChecksum: reproduced.export.technique.checksum === original.export.technique.checksum,
        durationDeltaMs: Math.abs(reproduced.export.technique.dureeMs - original.export.technique.dureeMs),
        sameResolution: reproduced.export.technique.largeur === original.export.technique.largeur && reproduced.export.technique.hauteur === original.export.technique.hauteur
      }
      evidence.supersededDefectiveArtifacts = {
        reason: 'Rendus antérieurs rejetés après inspection visuelle: props Remotion non propagées.',
        fixedBy: 'src/remotion/Root.tsx calculateMetadata returns props'
      }
      evidence.generatedAt = new Date().toISOString()
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
    }
    await ipc(page, 'projectsClose', projectId)
    console.log(JSON.stringify({ mode, projectId, results }, null, 2))
  } finally {
    await Promise.race([app.close().catch(() => undefined), new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000))])
  }
}

main().catch((error) => {
  console.error('PHASE13_RERENDER_FATAL', error)
  process.exitCode = 1
})
