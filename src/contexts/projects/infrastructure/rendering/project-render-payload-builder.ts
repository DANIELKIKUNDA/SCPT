import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import type { ProjectCompositionProps, PreviewMedia, PreviewScene } from '../../../../remotion/types/preview-types'
import { safeZoneForFormat } from '../../../../remotion/utils/declination-layout'
import type { DeclinaisonAudiovisuelle } from '../../domain/aggregates/declinaison-audiovisuelle'
import type { PisteNarrationRepository } from '../../domain/repositories/piste-narration.repository'
import type { PisteSousTitresRepository } from '../../domain/repositories/piste-sous-titres.repository'
import type { RessourceMediaRepository } from '../../domain/repositories/ressource-media.repository'
import type { SequenceSceneRepository } from '../../domain/repositories/sequence-scene.repository'
import type { RessourceMedia } from '../../domain/aggregates/ressource-media'
import type { Scene } from '../../domain/aggregates/scene'
import { RessourceMediaId } from '../../domain/value-objects/ressource-media-id'

type SceneRepoWithMedia = SequenceSceneRepository & {
  getMediaId(sceneId: Scene['id']): Promise<string | null>
}

function secureProjectPath(projectDir: string, relativePath: string): string {
  if (!relativePath || relativePath.includes('\\')) throw new Error('RENDER_INVALID_PROJECT_PATH')
  const root = resolve(projectDir)
  const absolute = resolve(root, relativePath)
  const rel = relative(root, absolute)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('RENDER_PATH_ESCAPE')
  return absolute
}

async function mediaToPreview(projectDir: string, media: RessourceMedia): Promise<PreviewMedia> {
  if (!media.isDisponible) throw new Error(`RENDER_MEDIA_UNAVAILABLE:${media.nomOriginal}`)
  const absolute = secureProjectPath(projectDir, media.cheminRelatif)
  if (!existsSync(absolute)) throw new Error(`RENDER_MEDIA_MISSING:${media.nomOriginal}`)
  let previewUrl: string | null = null
  if (media.mimeType.startsWith('image/')) {
    const bytes = await readFile(absolute)
    previewUrl = `data:${media.mimeType};base64,${bytes.toString('base64')}`
  }
  return {
    id: media.id.value,
    previewUrl,
    statut: media.statut,
    mimeType: media.mimeType,
    nomOriginal: media.nomOriginal,
    largeur: media.largeur,
    hauteur: media.hauteur
  }
}

export class ProjectRenderPayloadBuilder {
  constructor(
    private readonly projectDir: string,
    private readonly scenes: SceneRepoWithMedia,
    private readonly medias: RessourceMediaRepository,
    private readonly narration: PisteNarrationRepository,
    private readonly subtitles: PisteSousTitresRepository
  ) {}

  async build(declinaison: DeclinaisonAudiovisuelle): Promise<ProjectCompositionProps> {
    if (declinaison.isObsolete || !declinaison.isReadyForRender) throw new Error('RENDER_DECLINATION_NOT_READY')

    const narration = await this.narration.findByProject(declinaison.projetId)
    const finalTake = narration?.priseFinale ?? null
    if (!finalTake || narration?.statut !== 'validee') throw new Error('RENDER_FINAL_NARRATION_REQUIRED')
    const narrationPath = secureProjectPath(this.projectDir, finalTake.fichierAudio)
    if (!existsSync(narrationPath)) throw new Error('RENDER_NARRATION_FILE_MISSING')

    const sourceScenes = await this.scenes.loadSequence(declinaison.projetId)
    if (sourceScenes.length === 0) throw new Error('RENDER_SCENES_REQUIRED')

    const previewScenes: PreviewScene[] = []
    for (const scene of sourceScenes) {
      const mediaId = await this.scenes.getMediaId(scene.id)
      const media = mediaId ? await this.medias.findById(RessourceMediaId.from(mediaId)) : null
      if (scene.type === 'image' && !media) throw new Error(`RENDER_MEDIA_REQUIRED:${scene.id.value}`)
      const previewMedia = media ? await mediaToPreview(this.projectDir, media) : null
      if (scene.type === 'image' && !previewMedia?.previewUrl) {
        throw new Error(`RENDER_IMAGE_NOT_RENDERABLE:${scene.id.value}`)
      }
      previewScenes.push({
        id: scene.id.value,
        ordre: scene.ordre,
        type: scene.type,
        titre: scene.titre,
        texteAffiche: scene.texteAffiche,
        dureeMs: scene.dureeMs,
        composition: scene.composition,
        transition: scene.transition,
        media: previewMedia
      })
    }

    let subtitleTrack = await this.subtitles.findByDeclinaison(declinaison.id)
    subtitleTrack ??= await this.subtitles.findMaster()
    if (subtitleTrack && subtitleTrack.segments.length > 0 && subtitleTrack.statut !== 'validee') {
      throw new Error('RENDER_SUBTITLES_NOT_VALIDATED')
    }

    return {
      scenes: previewScenes,
      themeId: 'dark',
      reduceMotion: false,
      subtitles: subtitleTrack?.statut === 'validee'
        ? subtitleTrack.segments.map((segment) => ({
            id: segment.id,
            debutMs: segment.debutMs,
            finMs: segment.finMs,
            texte: segment.texte,
            position: segment.position,
            style: segment.style
          }))
        : [],
      declination: {
        id: declinaison.id.value,
        format: declinaison.format.value,
        resolution: declinaison.resolution.value,
        langue: declinaison.langue,
        profilExport: declinaison.profilExport.value,
        safeZone: safeZoneForFormat(declinaison.format.value),
        overrides: declinaison.overrides
      },
      showSafeZone: false
    }
  }
}

