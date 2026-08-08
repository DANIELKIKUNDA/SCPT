export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Projet non trouvé: ${projectId}`)
    this.name = 'ProjectNotFoundError'
  }
}

export class ProjectLockedError extends Error {
  constructor(projectId: string) {
    super(`Le projet ${projectId} est déjà ouvert (verrouillé)`)
    this.name = 'ProjectLockedError'
  }
}

export class ProjectManifestError extends Error {
  constructor(message: string) {
    super(`Manifeste projet invalide: ${message}`)
    this.name = 'ProjectManifestError'
  }
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(`Validation projet échouée: ${message}`)
    this.name = 'ProjectValidationError'
  }
}