const { bundle } = require('@remotion/bundler')
const { renderStill, selectComposition } = require('@remotion/renderer')
const { existsSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

async function main() {
  const root = process.cwd()
  const evidence = JSON.parse(readFileSync(join(root, 'dist', 'phase13', 'phase13-evidence.json'), 'utf8'))
  const declination = evidence.declinations.find((item) => item.format === 'HORIZONTAL_16_9' && !item.obsolete)
  const inputProps = {
    scenes: evidence.scenes.map((scene) => ({ ...scene, media: null })),
    themeId: 'dark',
    reduceMotion: false,
    subtitles: evidence.subtitles.segments,
    declination: {
      id: declination.id,
      format: declination.format,
      resolution: declination.resolution,
      langue: declination.langue,
      profilExport: declination.profilExport,
      safeZone: declination.safeZone,
      overrides: declination.overrides
    },
    showSafeZone: false
  }
  const candidates = [
    process.env.SCPT_RENDER_BROWSER,
    join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ]
  const browserExecutable = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!browserExecutable) throw new Error('Chrome executable not found')
  const serveUrl = await bundle({ entryPoint: resolve(root, 'src', 'remotion', 'index.ts') })
  const composition = await selectComposition({ serveUrl, id: 'SCPTProject', inputProps, browserExecutable })
  console.log(JSON.stringify({ sceneCount: inputProps.scenes.length, subtitleCount: inputProps.subtitles.length, composition }, null, 2))
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    browserExecutable,
    frame: 150,
    output: join(root, 'dist', 'phase13', 'frames', 'remotion-smoke.png'),
    imageFormat: 'png'
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
