// PHASE 4 PREFLIGHT — Dependency compatibility spikes (TEMPORARY)
// Run: node scripts/spike-phase4-deps.cjs
const { createHash } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync, rmdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const TMP = join(tmpdir(), 'scpt-phase4-' + Date.now());
mkdirSync(TMP, { recursive: true });

function sha256(p) { return createHash('sha256').update(readFileSync(p)).digest('hex'); }

async function run() {
  let ok = true;
  let sharpNodePass = false;
  let thumbnailPass = false;
  let fileTypePass = false;
  let fakeExtensionPass = false;
  let checksumPass = false;
  let musicMetadataPass = false;
  let sanitizePass = false;
  let chokidarPass = false;
  let copyPass = false;

  // 1. SHARP
  try {
    const sharp = require('sharp');
    const testImg = join(TMP, 'test.png');
    await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(testImg);
    sharpNodePass = true;

    const meta = await sharp(testImg).metadata();
    console.log('Sharp meta:', meta.width, 'x', meta.height);

    const thumb = join(TMP, 'thumb.png');
    await sharp(testImg).resize(16, 16).png().toFile(thumb);
    const thumbMeta = await sharp(thumb).metadata();
    thumbnailPass = thumbMeta.width === 16 && thumbMeta.height === 16;
    console.log('Thumbnail:', thumbMeta.width, 'x', thumbMeta.height);
  } catch (e) { console.error('Sharp failed:', e.message); }

  // 2. FILE-TYPE
  try {
    const ft = require('file-type');
    const pngBuf = readFileSync(join(TMP, 'test.png'));
    ft.fileTypeFromBuffer(pngBuf).then(result => {
      fileTypePass = result && result.mime === 'image/png';
      console.log('file-type:', result ? result.mime : 'null');

      // Fake extension test
      const fakeJpg = join(TMP, 'photo.jpg');
      writeFileSync(fakeJpg, 'not an image');
      ft.fileTypeFromBuffer(readFileSync(fakeJpg)).then(fakeResult => {
        fakeExtensionPass = fakeResult === undefined;
        console.log('fake extension:', fakeResult === undefined ? 'correctly rejected' : 'WRONG');
        checkDone();
      });
    });
  } catch (e) { console.error('file-type failed:', e.message); checkDone(); }

  function checkDone() {
    // 3. CHECKSUM
    try {
      const cp = join(TMP, 'hash-test.txt');
      writeFileSync(cp, 'hello world');
      const h1 = sha256(cp);
      const h2 = sha256(cp);
      writeFileSync(cp, 'hello world!');
      const h3 = sha256(cp);
      checksumPass = h1 === h2 && h1 !== h3;
      console.log('SHA-256:', h1 === h2 ? 'same=same' : 'ERROR', h1 !== h3 ? 'diff=diff' : 'ERROR');
    } catch (e) { console.error('checksum failed:', e.message); }

    // 4. MUSIC-METADATA
    try {
      const mm = require('music-metadata');
      const wavPath = join(TMP, 'test.wav');
      const wav = Buffer.alloc(44);
      wav.write('RIFF', 0); wav.writeUInt32LE(36, 4); wav.write('WAVE', 8);
      wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28);
      wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
      wav.write('data', 36); wav.writeUInt32LE(0, 40);
      writeFileSync(wavPath, wav);

      mm.parseFile(wavPath).then(meta => {
        console.log('music-metadata:', meta.format.sampleRate, 'Hz', meta.format.bitsPerSample, 'bits');
        musicMetadataPass = true;
        // Bad file test
        writeFileSync(join(TMP, 'bad.wav'), 'not audio');
        mm.parseFile(join(TMP, 'bad.wav')).then(() => console.log('SHOULD FAIL'))
          .catch(() => { console.log('invalid audio correctly rejected'); })
          .finally(runRemaining);
      }).catch(e => { console.error('mm parse failed:', e.message); runRemaining(); });
    } catch (e) { console.error('music-metadata failed:', e.message); runRemaining(); }

    function runRemaining() {
      // 5. SANITIZE-FILENAME
      try {
        const sanitize = require('sanitize-filename');
        const cases = ['cours:01?.png', 'CON.txt', 'nom<>video.mp4'];
        for (const c of cases) {
          const s = sanitize(c);
          console.log(c, '→', s);
        }
        sanitizePass = true;
      } catch (e) { console.error('sanitize failed:', e.message); }

      // 6. CHOKIDAR
      try {
        const chokidar = require('chokidar');
        const watchDir = join(TMP, 'watch');
        mkdirSync(watchDir, { recursive: true });
        let fired = false;
        const watcher = chokidar.watch(watchDir, { persistent: false });
        watcher.on('unlink', (p) => { console.log('chokidar: removed', p); fired = true; });
        watcher.on('ready', () => {
          const f = join(watchDir, 'test.txt');
          writeFileSync(f, 'data');
          setTimeout(() => { try { unlinkSync(f) } catch {} }, 100);
          setTimeout(() => { watcher.close(); chokidarPass = fired; finalReport(); }, 500);
        });
      } catch (e) { console.error('chokidar failed:', e.message); finalReport(); }

      function finalReport() {
        // 7. COPY
        try {
          const srcD = join(TMP, 'src'); mkdirSync(srcD, { recursive: true });
          const dstD = join(TMP, 'dst'); mkdirSync(dstD, { recursive: true });
          const src = join(srcD, 'img.jpg'); writeFileSync(src, 'source');
          const dst = join(dstD, 'img.jpg');
          copyFileSync(src, dst);
          copyPass = readFileSync(dst, 'utf-8') === 'source';
          console.log('copy:', copyPass ? 'ok' : 'OVERWRITTEN');
        } catch (e) { console.error('copy failed:', e.message); }

        console.log('\n=== RESULTS ===');
        console.log('1. Sharp Node:', sharpNodePass ? 'PASS' : 'FAIL');
        console.log('2. Thumbnail:', thumbnailPass ? 'PASS' : 'FAIL');
        console.log('3. File-type:', fileTypePass ? 'PASS' : 'FAIL');
        console.log('4. Fake ext:', fakeExtensionPass ? 'PASS' : 'FAIL');
        console.log('5. SHA-256:', checksumPass ? 'PASS' : 'FAIL');
        console.log('6. Music-metadata:', musicMetadataPass ? 'PASS' : 'FAIL');
        console.log('7. Sanitize:', sanitizePass ? 'PASS' : 'FAIL');
        console.log('8. Chokidar:', chokidarPass ? 'PASS' : 'FAIL');
        console.log('9. Copy:', copyPass ? 'PASS' : 'FAIL');

        const all = sharpNodePass && thumbnailPass && fileTypePass && fakeExtensionPass && checksumPass && musicMetadataPass && sanitizePass && chokidarPass && copyPass;
        try { rmdirSync(TMP, { recursive: true }) } catch {}
        process.exit(all ? 0 : 1);
      }
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });