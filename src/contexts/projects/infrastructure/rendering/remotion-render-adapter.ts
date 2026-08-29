import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { bundle } from '@remotion/bundler'
import { makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer'
import type { MoteurRenduPort, RenderEngineRequest, RenderEngineResult } from '../../application/ports/moteur-rendu.port'

function cancelledError(): Error {
  return new Error('RENDER_CANCELLED')
}

/**
 * Infrastructure-only Remotion adapter. The domain never imports Remotion.
 * The bundle is code-only and therefore reusable across projects: project data
 * is passed as inputProps to selectComposition/renderMedia.
 */
export class RemotionRenderAdapter implements MoteurRenduPort {
  private bundleEntryPoint: string | null = null
  private bundlePromise: Promise<string> | null = null
  private bundleLocation: string | null = null

  async render(
    request: RenderEngineRequest,
    options: { signal: AbortSignal; onProgress: (value: { progress: number }) => void | Promise<void> }
  ): Promise<RenderEngineResult> {
    if (!existsSync(request.entryPoint)) throw new Error('RENDER_ENTRY_POINT_MISSING')
    if (options.signal.aborted) throw cancelledError()

    const serveUrl = await this.ensureBundle(request.entryPoint)
    if (options.signal.aborted) throw cancelledError()

    const composition = await selectComposition({
      serveUrl,
      id: request.compositionId,
      inputProps: request.inputProps,
      browserExecutable: request.browserExecutable
    })
    if (options.signal.aborted) throw cancelledError()

    const cancellation = makeCancelSignal()
    const onAbort = (): void => cancellation.cancel()
    options.signal.addEventListener('abort', onAbort, { once: true })

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: request.outputPath,
        inputProps: request.inputProps,
        browserExecutable: request.browserExecutable,
        cancelSignal: cancellation.cancelSignal,
        onProgress: ({ progress }: { progress: number }) => {
          void options.onProgress({ progress })
        }
      })
      if (options.signal.aborted) throw cancelledError()
      return { outputPath: request.outputPath }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.signal.aborted || message.includes('renderMedia() got cancelled')) throw cancelledError()
      throw error
    } finally {
      options.signal.removeEventListener('abort', onAbort)
    }
  }

  async warmBundle(entryPoint: string): Promise<string> {
    return this.ensureBundle(entryPoint)
  }

  async dispose(): Promise<void> {
    const location = this.bundleLocation
    this.bundleLocation = null
    this.bundlePromise = null
    this.bundleEntryPoint = null
    if (location) await rm(location, { recursive: true, force: true })
  }

  private ensureBundle(entryPoint: string): Promise<string> {
    if (this.bundlePromise && this.bundleEntryPoint === entryPoint) return this.bundlePromise
    this.bundleEntryPoint = entryPoint
    this.bundlePromise = bundle({ entryPoint })
      .then((location) => {
        this.bundleLocation = location
        return location
      })
      .catch((error) => {
        this.bundlePromise = null
        this.bundleEntryPoint = null
        throw error
      })
    return this.bundlePromise
  }
}
