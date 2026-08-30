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
  droits: 'originale' | 'autorisee' | 'libre' | 'inconnue' | 'interdite'
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


export type SubtitleTrackStatusDto = 'brouillon' | 'a_resynchroniser' | 'validee' | 'obsolete'
export type SubtitlePositionDto = 'haut' | 'centre' | 'bas'

export interface SubtitleStyleDto {
  fontSize?: number
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold'
}

export interface SubtitleSegmentDto {
  id: string
  ordre: number
  debutMs: number
  finMs: number
  texte: string
  position: SubtitlePositionDto
  style?: SubtitleStyleDto
}

export interface SubtitleTrackDto {
  id: string
  declinaisonId: string
  langue: string
  segments: SubtitleSegmentDto[]
  statut: SubtitleTrackStatusDto
  versionNarration: number
}

export interface SubtitleExportDto {
  canceled: boolean
  format: 'srt' | 'vtt'
  fileName?: string
  relativeProjectPath?: string
}



export type DeclinaisonFormatDto = 'HORIZONTAL_16_9' | 'VERTICAL_9_16' | 'CARRE_1_1'
export type DeclinaisonStatusDto = 'brouillon' | 'adaptation_en_cours' | 'en_revision' | 'valide' | 'obsolete' | 'pret_pour_rendu'

export interface DeclinaisonResolutionDto {
  width: number
  height: number
}

export interface DeclinaisonSafeZoneDto {
  left: number
  right: number
  top: number
  bottom: number
}

export interface DeclinaisonSceneOverrideDto {
  sceneId: string
  layout?: SceneLayoutDto
  backgroundColor?: string
}

export interface DeclinaisonDto {
  id: string
  projectId: string
  format: DeclinaisonFormatDto
  resolution: DeclinaisonResolutionDto
  langue: string
  profilExport: 'MVP_PREMIUM'
  statut: DeclinaisonStatusDto
  versionProjetSource: number
  versionSourceCourante: number
  version: number
  obsolete: boolean
  pretPourRendu: boolean
  safeZone: DeclinaisonSafeZoneDto
  overrides: DeclinaisonSceneOverrideDto[]
}


export type RenderJobStatusDto =
  | 'demande'
  | 'en_attente'
  | 'en_preparation'
  | 'en_composition'
  | 'en_encodage'
  | 'en_verification'
  | 'termine'
  | 'echoue'
  | 'annule'

export interface RenderJobDto {
  id: string
  projectId: string
  declinaisonId: string
  tentative: number
  statut: RenderJobStatusDto
  progression: number
  cheminFichier: string | null
  checksum: string | null
  diagnostic: string | null
  profil: 'MVP_PREMIUM'
  versionProjetSource: number
  versionDeclinaisonSource: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  actif: boolean
  peutRelancer: boolean
  logRelativePath: string
}

export type FinalExportStatusDto =
  | 'demande'
  | 'en_attente'
  | 'en_preparation'
  | 'en_encodage'
  | 'en_verification'
  | 'termine'
  | 'echoue'
  | 'annule'

export interface FinalExportDto {
  id: string
  projectId: string
  renderJobId: string
  declinaisonId: string
  tentative: number
  statut: FinalExportStatusDto
  progression: number
  profil: 'MVP_PREMIUM'
  sourceRenderChecksum: string
  narrationTakeId: string
  narrationChecksum: string
  diagnostic: string | null
  technique: {
    nomFichier: string
    cheminFichier: string
    checksum: string
    tailleOctets: number
    dureeMs: number
    largeur: number
    hauteur: number
    fps: number
    codecVideo: 'h264'
    pixelFormat: 'yuv420p'
    codecAudio: 'aac'
    audioSampleRate: 48000
  } | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  actif: boolean
  peutRelancer: boolean
  logRelativePath: string
}


export type ReliabilityAuditSeverityDto = 'info' | 'warning' | 'blocking'
export type ReliabilityAuditStatusDto = 'healthy' | 'attention' | 'blocked'
export type ReliabilityChecklistStatusDto = 'ok' | 'warning' | 'blocked'

export interface ReliabilityAnomalyDto {
  code: string
  severity: ReliabilityAuditSeverityDto
  message: string
  detail: string | null
}

export interface ReliabilityChecklistDto {
  id: string
  label: string
  status: ReliabilityChecklistStatusDto
  detail: string
}

export interface ReliabilityAuditDto {
  id: string
  projectId: string
  status: ReliabilityAuditStatusDto
  anomalies: ReliabilityAnomalyDto[]
  checklist: ReliabilityChecklistDto[]
  createdAt: string
}

export interface ReliabilityBackupDto {
  id: string
  kind: 'automatic' | 'manual' | 'close' | 'migration' | 'pre_restore'
  createdAt: string
  appVersion: string
  projectFormatVersion: number
  databaseSchemaVersion: number
  fileCount: number
  totalBytes: number
  sourceFingerprint: string
}

export interface ReliabilityTaskDto {
  id: string
  kind: 'render' | 'final_export'
  projectId: string
  targetId: string
  status: string
  progress: number
  attempt: number
  diagnostic: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  active: boolean
  obsolete: boolean
}

export interface ReliabilityOverviewDto {
  audit: ReliabilityAuditDto
  backups: ReliabilityBackupDto[]
  tasks: ReliabilityTaskDto[]
  recentAudits: ReliabilityAuditDto[]
  crashRecovered: boolean
  versions: {
    formatVersion: number
    databaseSchemaVersion: number
    appVersion: string
  }
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
  mediaUpdateRights: (input: { mediaId: string; projetId: string; droits: MediaDto['droits'] }) => Promise<IpcResult<MediaDto>>
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
  subtitlesGet: (input: { projectId: string; langue: string }) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesSynchronize: (input: { projectId: string; langue: string }) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesUpdateSegment: (input: {
    projectId: string
    segmentId: string
    debutMs?: number
    finMs?: number
    texte?: string
    position?: SubtitlePositionDto
    style?: SubtitleStyleDto
  }) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesAddSegment: (input: {
    projectId: string
    debutMs: number
    finMs: number
    texte: string
    position: SubtitlePositionDto
    style?: SubtitleStyleDto
  }) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesDeleteSegment: (input: { projectId: string; segmentId: string }) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesValidate: (projectId: string) => Promise<IpcResult<SubtitleTrackDto>>
  subtitlesExport: (input: { projectId: string; format: 'srt' | 'vtt' }) => Promise<IpcResult<SubtitleExportDto>>

  declinaisonsList: (projectId: string) => Promise<IpcResult<DeclinaisonDto[]>>
  declinaisonsCreate: (input: {
    projectId: string
    format: DeclinaisonFormatDto
    langue: string
    profilExport?: 'MVP_PREMIUM'
  }) => Promise<IpcResult<DeclinaisonDto>>
  declinaisonsSetOverride: (input: {
    projectId: string
    declinaisonId: string
    sceneId: string
    layout?: SceneLayoutDto
    backgroundColor?: string
  }) => Promise<IpcResult<DeclinaisonDto>>
  declinaisonsRemoveOverride: (input: { projectId: string; declinaisonId: string; sceneId: string }) => Promise<IpcResult<DeclinaisonDto>>
  declinaisonsValidate: (input: { projectId: string; declinaisonId: string }) => Promise<IpcResult<DeclinaisonDto>>
  declinaisonsMarkReady: (input: { projectId: string; declinaisonId: string }) => Promise<IpcResult<DeclinaisonDto>>
  renderList: (projectId: string) => Promise<IpcResult<RenderJobDto[]>>
  renderStart: (input: { projectId: string; declinaisonId: string }) => Promise<IpcResult<RenderJobDto>>
  renderCancel: (input: { projectId: string; jobId: string }) => Promise<IpcResult<{ canceled: boolean }>>
  renderRetry: (input: { projectId: string; jobId: string }) => Promise<IpcResult<RenderJobDto>>
  renderReadLog: (input: { projectId: string; jobId: string }) => Promise<IpcResult<{ content: string }>>
  finalExportList: (projectId: string) => Promise<IpcResult<FinalExportDto[]>>
  finalExportStart: (input: { projectId: string; renderJobId: string }) => Promise<IpcResult<FinalExportDto>>
  finalExportCancel: (input: { projectId: string; exportId: string }) => Promise<IpcResult<{ canceled: boolean }>>
  finalExportRetry: (input: { projectId: string; exportId: string }) => Promise<IpcResult<FinalExportDto>>
  finalExportReadLog: (input: { projectId: string; exportId: string }) => Promise<IpcResult<{ content: string }>>
  finalExportOpenFile: (input: { projectId: string; exportId: string }) => Promise<IpcResult<{ opened: boolean }>>
  finalExportShowInFolder: (input: { projectId: string; exportId: string }) => Promise<IpcResult<{ shown: boolean }>>
  reliabilityOverview: (projectId: string) => Promise<IpcResult<ReliabilityOverviewDto>>
  reliabilityRunAudit: (projectId: string) => Promise<IpcResult<ReliabilityOverviewDto>>
  reliabilityCreateBackup: (projectId: string) => Promise<IpcResult<ReliabilityBackupDto>>
  reliabilityRestoreBackup: (input: { projectId: string; backupId: string }) => Promise<IpcResult<{
    restored: true
    backupId: string
    safetyBackupId: string
    requiresReopen: true
  }>>
  reliabilityCleanTemp: (projectId: string) => Promise<IpcResult<{
    removedEntries: number
    removedBytes: number
    skippedActive: number
  }>>
}
