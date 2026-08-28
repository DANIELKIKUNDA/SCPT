import { loader, type Monaco } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

let monacoInstance: Monaco | null = null
let pending: Promise<Monaco> | null = null

/**
 * Loads the local Monaco runtime once and wires local workers, then hands the
 * runtime to `@monaco-editor/react` so it never falls back to a CDN.
 *
 * The runtime (`monaco-editor/esm/vs/editor/editor.main.js`) is imported lazily:
 * it eagerly registers every language contribution at module evaluation, which
 * requires real DOM APIs (`document.queryCommandSupported`, etc.) that the
 * jsdom test environment does not implement. Keeping it out of the static
 * module graph means the editor runtime is only executed when a code scene is
 * actually displayed, both in the app and under Vitest.
 */
export function configureMonaco(): Promise<Monaco> {
  if (monacoInstance) return Promise.resolve(monacoInstance)
  if (pending) return pending

  window.MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string): Worker => {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    }
  }

  pending = import('monaco-editor/esm/vs/editor/editor.main.js')
    .then((module) => {
      const monaco = module as Monaco
      loader.config({ monaco })
      monacoInstance = monaco
      return monaco
    })

  return pending
}