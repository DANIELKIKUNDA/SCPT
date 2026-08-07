# 04 — Structure des dossiers et fichiers

## 1. Règle

La structure suivante est canonique. Codex ne doit pas la modifier sans décision explicite.

## 2. Dépôt

```text
scpt/
├── docs/
│   ├── implementation/
│   ├── reference/
│   └── archive/
├── resources/
│   ├── ffmpeg/
│   ├── piper/
│   ├── voices/
│   ├── icons/
│   └── templates/
├── scripts/
├── src/
│   ├── main/
│   ├── preload/
│   ├── renderer/
│   ├── contexts/
│   ├── shared/
│   └── remotion/
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── build/
├── package.json
├── pnpm-lock.yaml
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── eslint.config.js
├── prettier.config.mjs
└── README.md
```

## 3. `src/main`

```text
src/main/
├── bootstrap/
├── windows/
├── ipc/
├── tasks/
├── security/
├── persistence/
├── media/
├── rendering/
├── voice/
├── logging/
└── index.ts
```

### Responsabilités

- démarrage Electron ;
- création des fenêtres ;
- enregistrement des handlers IPC ;
- orchestration des tâches ;
- base SQLite ;
- adaptateurs FFmpeg, Piper, Remotion ;
- sécurité ;
- logs.

## 4. `src/preload`

```text
src/preload/
├── contracts/
├── api/
├── schemas/
└── index.ts
```

Expose uniquement des méthodes sûres :

```ts
window.scpt.projects.create()
window.scpt.projects.open()
window.scpt.media.import()
window.scpt.voice.generate()
window.scpt.render.start()
window.scpt.render.cancel()
```

## 5. `src/renderer`

```text
src/renderer/
├── app/
├── pages/
├── features/
├── components/
├── layouts/
├── stores/
├── hooks/
├── styles/
├── assets/
└── main.tsx
```

### `features`

```text
features/
├── projects/
├── scenes/
├── media-library/
├── narration/
├── subtitles/
├── preview/
├── rendering/
├── exports/
└── settings/
```

## 6. `src/contexts`

```text
src/contexts/
├── projects/
├── composition/
├── media/
├── narration/
├── subtitles/
├── variants/
├── rendering/
└── history/
```

Chaque contexte :

```text
context/
├── domain/
│   ├── aggregates/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── errors/
│   ├── repositories/
│   └── ports/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── use-cases/
│   ├── dto/
│   └── mappers/
├── infrastructure/
│   ├── persistence/
│   ├── adapters/
│   └── mappers/
└── interfaces/
    └── ipc/
```

## 7. `src/shared`

```text
src/shared/
├── domain/
├── application/
├── infrastructure/
├── types/
├── errors/
├── validation/
└── utils/
```

Le shared reste minimal. Il ne contient pas d’entités métier génériques.

## 8. `src/remotion`

```text
src/remotion/
├── Root.tsx
├── compositions/
├── scenes/
├── components/
├── animations/
├── subtitles/
├── themes/
├── fonts/
└── types/
```

Ce dossier contient la représentation de rendu, pas les agrégats du domaine.

## 9. Dossier physique d’un projet utilisateur

```text
SCPTProjects/
└── <project-id>/
    ├── project.scpt.json
    ├── database/
    │   └── project.sqlite
    ├── media/
    │   ├── sources/
    │   ├── proxies/
    │   ├── thumbnails/
    │   └── derived/
    ├── audio/
    │   ├── narration/
    │   ├── music/
    │   └── temp/
    ├── subtitles/
    ├── renders/
    │   ├── previews/
    │   ├── final/
    │   └── failed/
    ├── logs/
    ├── backups/
    └── temp/
```

## 10. Fichier `project.scpt.json`

Contient uniquement :

- identifiant ;
- titre ;
- version de format ;
- chemin de base ;
- base SQLite ;
- date de création ;
- date de dernière ouverture ;
- version de l’application ;
- options de récupération.

Il ne duplique pas tout le contenu SQLite.

## 11. Base SQLite

Tables initiales :

- `projects`
- `scenes`
- `scene_media`
- `media_resources`
- `narration_tracks`
- `narration_segments`
- `subtitle_tracks`
- `subtitle_segments`
- `variants`
- `render_jobs`
- `exports`
- `audit_entries`
- `migrations`

## 12. Conventions de fichiers

- chemins relatifs dans la base ;
- UTF-8 ;
- noms sûrs ;
- slug + langue + format + version ;
- aucune donnée sensible dans un nom ;
- sources immuables ;
- temporaires supprimables ;
- exports finaux immuables.

## 13. Fichiers de configuration

### `package.json`

Scripts canoniques :

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "package:win": "electron-builder --win"
  }
}
```

### `electron-builder.yml`

Doit inclure :

- applicationId ;
- nom produit ;
- ressources ;
- binaires FFmpeg/Piper ;
- modèles de voix ;
- fichiers Remotion ;
- asarUnpack pour les binaires et modules natifs ;
- cible NSIS ;
- architecture x64 initialement.

## 14. Fichiers interdits dans Git

```text
node_modules/
dist/
out/
release/
coverage/
*.log
.env
.env.*
!.env.example
SCPTProjects/
temp/
renders/
resources/voices/private/
```

## 15. Règle Codex

Avant de créer un fichier, Codex doit :

1. identifier son contexte ;
2. identifier sa couche ;
3. vérifier qu’un fichier équivalent n’existe pas ;
4. expliquer brièvement son rôle ;
5. respecter la structure canonique.
