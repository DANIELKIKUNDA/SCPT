/// <reference types="vite/client" />

declare module '*?worker' {
  const WorkerFactory: new () => Worker
  export default WorkerFactory
}

declare module 'monaco-editor/esm/vs/editor/editor.main.js' {
  export * from 'monaco-editor/esm/vs/editor/editor.api'
}

declare module 'react-katex' {
  import type { FC, ReactNode } from 'react'
  export const InlineMath: FC<{ math: string; renderError?: (error: Error) => ReactNode }>
  export const BlockMath: FC<{ math: string; renderError?: (error: Error) => ReactNode }>
}

declare module 'katex' {
  const katex: {
    renderToString(tex: string, options?: Record<string, unknown>): string
    render(tex: string, element: HTMLElement, options?: Record<string, unknown>): void
    version: string
  }
  export default katex
  export const renderToString: typeof katex.renderToString
  export const render: typeof katex.render
}

interface Window {
  electronAPI?: import('../../shared/types/electron-api').ElectronAPI
  MonacoEnvironment?: {
    getWorker: (_moduleId: string, label: string) => Worker
  }
}
