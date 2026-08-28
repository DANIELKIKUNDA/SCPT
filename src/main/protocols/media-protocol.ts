import { app, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { createDrizzleMediaRepository } from '../../contexts/projects/infrastructure/persistence/drizzle-media-repository'
import { ProjetAudiovisuelId } from '../../contexts/projects/domain/value-objects/projet-audiovisuel-id'
import { RessourceMediaId } from '../../contexts/projects/domain/value-objects/ressource-media-id'
import { getProjectManifestService } from '../persistence/project-manifest'
import { logger } from '../logging/logger'

const SCHEME = 'scpt-media'

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true
      }
    }
  ])
}

export function toMediaPreviewUrl(projectId: string, mediaId: string): string {
  return `${SCHEME}://media/${encodeURIComponent(projectId)}/${encodeURIComponent(mediaId)}`
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  })
}

export function registerMediaProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'media') return errorResponse(404, 'Unknown SCPT media route')

      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      if (segments.length !== 2) return errorResponse(400, 'Invalid SCPT media URL')

      const [projectIdRaw, mediaIdRaw] = segments
      const projectId = ProjetAudiovisuelId.from(projectIdRaw)
      const mediaId = RessourceMediaId.from(mediaIdRaw)
      const repository = createDrizzleMediaRepository(
        getProjectManifestService().getDatabasePath(projectId.value)
      )
      try {
        const media = await repository.findById(mediaId)

        if (!media || media.projetId.value !== projectId.value) {
          return errorResponse(404, 'Media not found')
        }
        if (!media.isDisponible) return errorResponse(404, 'Media unavailable')
        if (!['image', 'logo'].includes(media.type) || !media.mimeType.startsWith('image/')) {
          return errorResponse(415, 'Media type is not previewable in Phase 5')
        }

        const projectDir = resolve(app.getPath('userData'), 'projects', projectId.value)
        const absolutePath = resolve(projectDir, media.cheminRelatif)
        const rel = relative(projectDir, absolutePath)
        if (rel.startsWith('..') || isAbsolute(rel)) {
          logger.warn({ projectId: projectId.value, mediaId: mediaId.value }, 'Blocked media path escape')
          return errorResponse(403, 'Forbidden media path')
        }
        if (!existsSync(absolutePath)) return errorResponse(404, 'Media file missing')

        const bytes = await readFile(absolutePath)
        return new Response(new Uint8Array(bytes), {
          status: 200,
          headers: {
            'content-type': media.mimeType || 'application/octet-stream',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff'
          }
        })
      } finally {
        repository.close()
      }
    } catch (error) {
      logger.warn({ err: error, url: request.url }, 'SCPT media protocol request failed')
      return errorResponse(400, 'Invalid media request')
    }
  })
}
