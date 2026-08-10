/// <reference types="vite/client" />

interface ElectronAPI {
  systemPing: () => Promise<unknown>
  systemGetAppInfo: () => Promise<unknown>
  preferencesGet: (key: string) => Promise<unknown>
  preferencesSet: (data: Record<string, unknown>) => Promise<unknown>
  projectsCreate: (input: Record<string, unknown>) => Promise<unknown>
  projectsOpen: (projectId: string) => Promise<unknown>
  projectsClose: (projectId: string) => Promise<unknown>
  projectsListRecent: () => Promise<unknown>
  projectsArchive: (projectId: string) => Promise<unknown>
  projectsRestore: (projectId: string) => Promise<unknown>
  scenesLoadSequence: (projectId: string) => Promise<unknown>
  scenesCreate: () => Promise<unknown>
  scenesUpdate: (input: { sceneId: string; projetId: string; titre?: string | null; narrationTexte?: string | null; texteAffiche?: string | null; dureeMs?: number }) => Promise<unknown>
  scenesDelete: (input: { sceneId: string; projetId: string }) => Promise<unknown>
  scenesDuplicate: (input: { sceneId: string; projetId: string }) => Promise<unknown>
  scenesReorder: (input: { projetId: string; orderedIds: string[] }) => Promise<unknown>
  mediaImport: (input: { sourcePath: string; projetId: string }) => Promise<unknown>
  mediaList: (projetId: string) => Promise<unknown>
  mediaMarkMissing: (input: { mediaId: string; projetId: string }) => Promise<unknown>
  mediaReplace: (input: { mediaId: string; projetId: string; sourcePath: string }) => Promise<unknown>
}

interface Window {
  electronAPI?: ElectronAPI
}