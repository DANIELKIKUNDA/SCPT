import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // file-type, music-metadata and execa are ESM-only ("type": "module") packages.
    // Leaving them externalized emits require("<pkg>") in the CJS main bundle,
    // which crashes at Electron startup (ERR_PACKAGE_PATH_NOT_EXPORTED / ERR_REQUIRE_ESM).
    // Bundling these pure-JS packages avoids the CJS/ESM interop failure.
    // Phase 6 adds p-queue/p-limit; both are ESM-only and run in main narration orchestration.
    // Bundling them with execa keeps the Electron CJS main runtime compatible.
    plugins: [externalizeDepsPlugin({ exclude: ['file-type', 'music-metadata', 'execa', 'p-queue', 'p-limit'] })],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})