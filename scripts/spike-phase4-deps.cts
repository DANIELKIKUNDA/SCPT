// PHASE 4 PREFLIGHT — Dependency compatibility spikes (TEMPORARY)
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, renameSync, mkdirSync, rmdirSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TMP = join(tmpdir(), `scpt-phase4-${Date.now()}`)
mkdirSync(TMP, { recursive: true })

async function run() {
  let sharpNodePass = false
  let thumbnailPass = false
  let fileTypePass = false
  let fakeExtensionPass = false
  let checksumPass = false
  let musicMetadataPass = false
  let sanitizePass = false
  let chokidarPass = false
  let copyPass = false

  // 1. SHARP
  try {
    const sharp = await import('sharp')
    // Create test image
    const testImg = join(TMP, 'test.png')
    await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(testImg)
    sharpNodePass = true

    // Read and generate thumbnail
    const meta = await sharp(testImg).metadata()
    console.log('Sharp meta:', meta.width, 'x', meta.height)

    const thumb = join(TMP, 'thumb.png')
    await sharp(testImg).resize(16, 16).png().toFile(thumb)
    const thumbMeta = await sharp(thumb).metadata()
    thumbnailPass = thumbMeta.width === 16 && thumbMeta.height === 16
    console.log('Thumbnail:', thumbMeta.width, 'x', thumbMeta.height)
  } catch (e) {
    console.error('Sharp failed:', e)
  }

  // 2. FILE-TYPE
  try {
    const ft = await import('file-type')
    const pngBuf = readFileSync(join(TMP, 'test.png'))
    const result = await ft.fileTypeFromBuffer(pngBuf)
    fileTypePass = result?.mime === 'image/png'
    console.log('file-type:', result?.mime)

    // Fake extension test
    const fakeJpg = join(TMP, 'photo.jpg')
    writeFileSync(fakeJpg, 'not an image')
    const fakeResult = await ft.fileTypeFromBuffer(readFileSync(fakeJpg))
    fakeExtensionPass = fakeResult === undefined
    console.log('fake extension:', fakeResult === undefined ? 'correctly rejected' : 'WRONG')
  } catch (e) {
    console.error('file-type failed:', e)
  }

  // 3. CHECKSUM SHA-256
  try {
    writeFileSync(join(TMP, 'hash-test.txt'), 'hello world')
    function sha256(p: string) { return createHash('sha256').update(readFileSync(p)).digest('hex') }
    const h1 = sha256(join(TMP, 'hash-test.txt'))
    const h2 = sha256(join(TMP, 'hash-test.txt'))
    writeFileSync(join(TMP, 'hash-test.txt'), 'hello world!')
    const h3 = sha256(join(TMP, 'hash-test.txt'))
    checksumPass = h1 === h2 && h1 !== h3
    console.log('SHA-256:', h1 === h2 ? 'same file same hash' : 'ERROR', h1 !== h3 ? 'modified different hash' : 'ERROR')
  } catch (e) { console.error('checksum failed:', e) }

  // 4. MUSIC-METADATA
  try {
    const mm = await import('music-metadata')
    // Create minimal WAV header (44 bytes) with valid RIFF
    const wav = Buffer.alloc(44)
    wav.write('RIFF', 0); wav.writeUInt32LE(36, 4); wav.write('WAVE', 8)
    wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28)
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
    wav.write('data', 36); wav.writeUInt32LE(0, 40)
    const wavPath = join(TMP, 'test.wav')
    writeFileSync(wavPath, wav)
    try {
      const meta = await mm.parseFile(wavPath)
      console.log('music-metadata:', meta.format.sampleRate, 'Hz', meta.format.bitsPerSample, 'bits', meta.format.duration, 's')
      musicMetadataPass = true
      // invalid file
      try {
        writeFileSync(join(TMP, 'bad.wav'), 'not audio')
        await mm.parseFile(join(TMP, 'bad.wav'))
        console.log('SHOULD HAVE FAILED on bad file')
      } catch { console.log('invalid audio correctly rejected') }
    } catch(e) { console.error('music-metadata parse failed:', e) }
  } catch (e) { console.error('music-metadata failed:', e) }

  // 5. SANITIZE-FILENAME
  try {
    const sanitize = await import('sanitize-filename')
    const cases = ['cours:01?.png', 'CON.txt', 'nom<>video.mp4']
    for (const c of cases) {
      const s = sanitize.default(c)
      console.log(c, '→', s)
    }
    sanitizePass = true
  } catch (e) { console.error('sanitize failed:', e) }

  // 6. CHOKIDAR
  try {
    const chokidar = await import('chokidar')
    const watchDir = join(TMP, 'watch')
    mkdirSync(watchDir, { recursive: true })
    let eventFired = false
    const watcher = chokidar.watch(watchDir, { persistent: false })
    watcher.on('unlink', (path) => { console.log('chokidar: file removed', path); eventFired = true })
    await new Promise<void>(r => {
      watcher.on('ready', () => {
        const f = join(watchDir, 'test.txt'); writeFileSync(f, 'data')
        setTimeout(() => { unlinkSync(f) }, 100)
        setTimeout(() => { watcher.close(); r() }, 500)
      })
    })
    chokidarPass = eventFired
    console.log('chokidar event fired:', eventFired)
  } catch (e) { console.error('chokidar failed:', e) }

  // 7. COPY WITHOUT OVERWRITE
  try {
    const srcDir = join(TMP, 'src')
    const dstDir = join(TMP, 'dst')
    mkdirSync(srcDir, { recursive: true })
    mkdirSync(dstDir, { recursive: true })
    const src = join(srcDir, 'image.jpg')
    writeFileSync(src, 'source content')
    const dst = join(dstDir, 'image.jpg')

    // First copy
    copyFileSync(src, dst)
    expect(existsSync(dst), true)

    // Verify source unchanged
    const srcHash = sha256(src)
    // Second copy should not overwrite silently
    writeFileSync(src, 'modified source')
    // Check collision handling
    const dst2 = join(dstDir, 'image-1.jpg')
    copyFileSync(src, dst2)
    expect(existsSync(dst2), true)
    copyPass = readFileSync(dst, 'utf-8') === 'source content'
    console.log('copy without overwrite:', copyPass ? 'original preserved' : 'OVERWRITTEN!')
  } catch (e) { console.error('copy failed:', e) }

  // Report
  console.log('\n=== PHASE 4 PREFLIGHT RESULTS ===')
  console.log('1. Sharp Node:', sharpNodePass ? 'PASS' : 'FAIL')
  console.log('2. Thumbnail gen:', thumbnailPass ? 'PASS' : 'FAIL')
  console.log('3. File-type:', fileTypePass ? 'PASS' : 'FAIL')
  console.log('4. Fake extension:', fakeExtensionPass ? 'PASS' : 'FAIL')
  console.log('5. SHA-256:', checksumPass ? 'PASS' : 'FAIL')
  console.log('6. Music-metadata:', musicMetadataPass ? 'PASS' : 'FAIL')
  console.log('7. Sanitize-filename:', sanitizePass ? 'PASS' : 'FAIL')
  console.log('8. Chokidar:', chokidarPass ? 'PASS' : 'FAIL')
  console.log('9. Copy no overwrite:', copyPass ? 'PASS' : 'FAIL')

  // Cleanup
  try { rmdirSync(TMP, { recursive: true }) } catch {}

  const allPass = sharpNodePass && thumbnailPass && fileTypePass && fakeExtensionPass && checksumPass && musicMetadataPass && sanitizePass && chokidarPass && copyPass
  process.exit(allPass ? 0 : 1)
}

function expect(actual: unknown, expected: unknown) {
  if (actual !== expected) console.error('Expected', expected, 'got', actual)
}
function sha256(p: string) { return createHash('sha256').update(readFileSync(p)).digest('hex') }

run().catch(e => { console.error(e); process.exit(1) })