export type StatutProjet =
  | 'BROUILLON'
  | 'EN_CONCEPTION'
  | 'EN_PRODUCTION'
  | 'EN_REVISION'
  | 'CORRECTIONS_REQUISES'
  | 'VALIDE'
  | 'PRET_POUR_RENDU'
  | 'RENDU'
  | 'ARCHIVE'

export const StatutProjet = {
  BROUILLON: 'BROUILLON' as const,
  EN_CONCEPTION: 'EN_CONCEPTION' as const,
  EN_PRODUCTION: 'EN_PRODUCTION' as const,
  EN_REVISION: 'EN_REVISION' as const,
  CORRECTIONS_REQUISES: 'CORRECTIONS_REQUISES' as const,
  VALIDE: 'VALIDE' as const,
  PRET_POUR_RENDU: 'PRET_POUR_RENDU' as const,
  RENDU: 'RENDU' as const,
  ARCHIVE: 'ARCHIVE' as const
} as const

export const statutProjetTransitions: Record<StatutProjet, StatutProjet[]> = {
  BROUILLON: ['EN_CONCEPTION', 'ARCHIVE'],
  EN_CONCEPTION: ['EN_PRODUCTION', 'BROUILLON', 'ARCHIVE'],
  EN_PRODUCTION: ['EN_REVISION', 'EN_CONCEPTION', 'ARCHIVE'],
  EN_REVISION: ['CORRECTIONS_REQUISES', 'VALIDE', 'ARCHIVE'],
  CORRECTIONS_REQUISES: ['EN_REVISION', 'ARCHIVE'],
  VALIDE: ['PRET_POUR_RENDU', 'ARCHIVE'],
  PRET_POUR_RENDU: ['RENDU', 'VALIDE', 'ARCHIVE'],
  RENDU: ['ARCHIVE'],
  ARCHIVE: []
}

export function transitionAllowed(from: StatutProjet, to: StatutProjet): boolean {
  return statutProjetTransitions[from].includes(to)
}