import type { IpcResult } from './ipc'

export type SceneTypeDto = 'texte' | 'formule' | 'image' | 'code' | 'diagramme'
export type SceneLayoutDto = 'centered' | 'top' | 'split-left' | 'split-right'
export type SceneTransitionTypeDto = 'fade' | 'slide-left' | 'slide-right' | 'none'

export interface SceneCompositionDto {
  backgroundColor: string
  layout: SceneLayoutDto
}

export interface SceneTransitionDto {
  type: SceneTransitionTypeDto
  durationMs: number
}

export interface ProjectSummaryDto {
  id: string
  titre: string
  type: string
  statut: string
  updatedAt: string
  isArchived: boolean
}

export interface ProjectDto {
  id: string
  titre: string
  type: string
  objectif: string
  publicCible: string
  langueSource: string
  statut: string
  version: number
  createdAt: string
  updatedAt: string
  isArchived: boolean
}

export interface SceneDto {
  id: string
  projetId: string
  ordre: number
  type: SceneTypeDto
  titre: string | null
  narrationTexte: string | null
  texteAffiche: string | null
  dureeMs: number
  composition: SceneCompositionDto
  transition: SceneTransitionDto
  mediaId: string | null
}

export interface MediaDto {
  id: string
  type: string
  cheminRelatif: string
  nomOriginal: string
  checksum: string
  tailleOctets: number
  mimeType: string
  largeur: number | null
  hauteur: number | null
  dureeMs: number | null
  statut: string
  previewUrl: string | null
}


export type NarrationTrackStatusDto = 'brouillon' | 'generee' | 'validee' | 'obsolete'
export type NarrationSegmentStatusDto = 'generee' | 'importee' | 'erreur' | 'annulee'
export type NarrationSourceDto = 'piper' | 'import'

export interface NarrationTakeDto {
  id: string
  texte: string
  sceneId: string | null
  fichierAudio: string
  dureeMs: number
  ordre: number
  statut: NarrationSegmentStatusDto
  source: NarrationSourceDto
  voixId: string | null
  checksum: string
  createdAt: string
}

export interface NarrationTrackDto {
  id: string
  projetId: string
  langue: string
  prises: NarrationTakeDto[]
  priseFinaleId: string | null
  statut: NarrationTrackStatusDto
  versionTexte: number
}

export interface ElectronAPI {
  systemPing: () => Promise<IpcResult<{ message: 'pong'; timestamp: number }>>
  systemGetAppInfo: () => Promise<IpcResult<{
    name: string
    version: string
    electronVersion: string
    isDev: boolean
  }>>
  preferencesGet: (key: string) => Promise<IpcResult<{ key: string; value: unknown }>>
  preferencesSet: (data: Record<string, unknown>) => Promise<IpcResult<{
    theme: string
    language: string
    reduceMotion: boolean
  }>>
  projectsCreate: (input: Record<string, unknown>) => Promise<IpcResult<{
    id: string
    titre: string
    type: string
    statut: string
    createdAt: string
  }>>
  projectsOpen: (projectId: string) => Promise<IpcResult<ProjectDto>>
  projectsClose: (projectId: string) => Promise<IpcResult<{ released: boolean }>>
  projectsListRecent: () => Promise<IpcResult<ProjectSummaryDto[]>>
  projectsArchive: (projectId: string) => Promise<IpcResult<{ id: string; statut: string; archivedAt: string | null }>>
  projectsRestore: (projectId: string) => Promise<IpcResult<{ id: string; statut: string }>>
  scenesLoadSequence: (projectId: string) => Promise<IpcResult<SceneDto[]>>
  scenesCreate: (input: {
    projetId: string
    type: SceneTypeDto
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
  }) => Promise<IpcResult<SceneDto>>
  scenesUpdate: (input: {
    sceneId: string
    projetId: string
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
    composition?: SceneCompositionDto
    transition?: SceneTransitionDto
  }) => Promise<IpcResult<SceneDto>>
  scenesDelete: (input: { sceneId: string; projetId: string }) => Promise<IpcResult<{ deleted: boolean }>>
  scenesDuplicate: (input: { sceneId: string; projetId: string }) => Promise<IpcResult<SceneDto>>
  scenesReorder: (input: { projetId: string; orderedIds: string[] }) => Promise<IpcResult<{ reordered: boolean }>>
  mediaImport: (input: { sourcePath: string; projetId: string }) => Promise<IpcResult<MediaDto & { thumbnailPath: string | null }>>
  mediaList: (projetId: string) => Promise<IpcResult<MediaDto[]>>
  mediaAssociate: (input: { sceneId: string; mediaId: string; projetId: string }) => Promise<IpcResult<{ associated: boolean }>>
  mediaMarkMissing: (input: { mediaId: string; projetId: string }) => Promise<IpcResult<{ id: string; statut: string }>>
  mediaReplace: (input: { mediaId: string; projetId: string; sourcePath: string }) => Promise<IpcResult<{
    id: string
    cheminRelatif: string
    statut: string
    thumbnailPath: string | null
  }>>
  narrationGet: (input: { projectId: string; langue: string }) => Promise<IpcResult<NarrationTrackDto>>
  narrationGenerate: (input: {
    projectId: string
    langue: string
    texte: string
    voixId: string
    sceneId?: string | null
  }) => Promise<IpcResult<NarrationTrackDto>>
  narrationImport: (input: {
    projectId: string
    langue: string
    texte?: string
    sceneId?: string | null
  }) => Promise<IpcResult<NarrationTrackDto & { canceled?: boolean }>>
  narrationSelectFinal: (input: { projectId: string; takeId: string }) => Promise<IpcResult<NarrationTrackDto>>
  narrationReadAudio: (input: { projectId: string; takeId: string }) => Promise<IpcResult<{ base64: string; mimeType: string }>>
  narrationCancel: (projectId: string) => Promise<IpcResult<{ canceled: boolean }>>
}
