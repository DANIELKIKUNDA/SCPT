# 08 — Matrice de verrouillage intégral

## Produit
| Sujet | Décision |
|---|---|
| Produit | Application de bureau |
| Utilisateur | Daniel uniquement |
| Mode | Local-first et hors ligne |
| Plateforme | Windows 11 x64 |
| Publication automatique | Hors MVP |
| Avatar | Facultatif |
| Cloud | Non obligatoire |
| Multi-utilisateur | Interdit dans le MVP |

## Pile
| Sujet | Décision |
|---|---|
| Gestionnaire | pnpm |
| Desktop | Electron |
| Build | electron-vite |
| UI | React |
| Langage | TypeScript strict |
| Styles | Tailwind CSS |
| État UI | Zustand |
| Formulaires | React Hook Form + Zod |
| Base | SQLite |
| ORM | Drizzle ORM |
| Vidéo | Remotion |
| Encodage | FFmpeg |
| Inspection | FFprobe |
| Voix | Piper |
| Packaging | electron-builder + NSIS |
| Tests unitaires | Vitest |
| Tests UI | Testing Library |
| E2E | Playwright |
| Logs | Pino |

## Architecture
| Sujet | Décision |
|---|---|
| Backend local | Electron main |
| Pont | preload typé |
| Frontend | renderer React |
| Accès Node renderer | Interdit |
| Domaine | Sans framework |
| Backend web | Interdit |
| Microservices | Interdits |
| IPC | Typé + Zod |
| Catalogue global | SQLite globale |
| Données projet | SQLite par projet |
| Fichiers lourds | Système de fichiers |

## Fonctions MVP
| Fonction | Décision |
|---|---|
| Projets | Obligatoire |
| Scènes | Obligatoire |
| Médias | Obligatoire |
| Narration importée | Obligatoire |
| Piper | Obligatoire |
| Sous-titres | Obligatoire |
| Prévisualisation | Obligatoire |
| 16:9, 9:16, 1:1 | Obligatoires |
| Rendu Remotion | Obligatoire |
| MP4 H.264/AAC | Obligatoire |
| Historique | Obligatoire |
| Sauvegarde/restauration | Obligatoire |
| Publication distante | Hors MVP |
| Collaboration | Hors MVP |

## Distribution
| Sujet | Décision |
|---|---|
| Installateur | NSIS x64 |
| Droits admin | Non requis |
| Désinstallation projets | Jamais |
| Auto-update | Non |
| Signature | Facultative MVP interne |
| Binaires média | Embarqués |
| Voix française | Embarquée |
| Internet | Non requis pour le cœur |

## Qualité
| Sujet | Décision |
|---|---|
| Une phase active | Oui |
| Tests avant phase suivante | Oui |
| Typecheck/lint/tests | Obligatoires |
| CI GitHub | Obligatoire |
| Packaging Windows CI | Obligatoire |
| Prototype logarithmes | Obligatoire |
| Rapport limitations | Obligatoire |

## Données
| Sujet | Décision |
|---|---|
| Sources écrasées | Jamais |
| Exports réussis | Immuables |
| Checksums | Obligatoires |
| Migrations | Versionnées |
| Backup avant migration | Obligatoire |
| Snapshot | Toutes les 15 min |
| Restauration destructive | Interdite |
| Projet portable | Oui |
| Catalogue global reconstruisible | Oui |

## Sécurité
| Sujet | Décision |
|---|---|
| contextIsolation | true |
| nodeIntegration | false |
| Shell concaténé | Interdit |
| Secrets renderer | Interdits |
| Validation IPC | Zod |
| Type réel fichiers | Vérifié |
| Actions sensibles | Confirmation |

## Seul verrou validé par exécution
Les numéros exacts des versions sont verrouillés par :
`package.json + pnpm-lock.yaml + rapport de compatibilité + build + packaging + test installé`.

## Verdict
Toutes les décisions du MVP sont fixées. Codex ne demande une nouvelle décision que si une incompatibilité, une restriction de licence ou une défaillance réelle est démontrée. Il ne remplace jamais silencieusement une solution canonique.
