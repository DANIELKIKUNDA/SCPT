import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // better-sqlite3 can trigger a native Node 24 cleanup assertion when
    // several forked Vitest workers tear down concurrently on Windows.
    // A single worker thread keeps the complete suite deterministic while
    // preserving test isolation and every assertion.
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 1,
    // Phase 2–5 suites open real SQLite databases and take real filesystem
    // locks (better-sqlite3 / proper-lockfile). Under parallel worker load on
    // Windows, a single lock acquisition can exceed Vitest's 5s default, so we
    // raise the ceiling for the whole suite without disabling any assertion.
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  }
})
