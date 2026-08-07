# SCPT — Studio de Création Pédagogique et Technique

Application de bureau Electron + React + TypeScript.

## Phase 0 — Initialisation du dépôt

Cette phase établit le socle technique minimal :

- Electron avec contextIsolation et nodeIntegration: false
- React 18 avec TypeScript strict
- electron-vite pour le build
- Vitest pour les tests
- ESLint + Prettier pour la qualité de code
- CI GitHub Actions avec Node.js 24 et pnpm

## Prérequis

- **Node.js 24.x** (canonique pour le projet)
- **pnpm** (le package manager est épinglé dans `package.json`)

## Installation

```bash
pnpm install --frozen-lockfile
```

## Scripts disponibles

| Commande | Description |
|---|---|
| `pnpm dev` | Lance Electron en mode développement |
| `pnpm build` | Build de production (main, preload, renderer) |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | Linting ESLint |
| `pnpm format` | Formatage Prettier |
| `pnpm test` | Tests Vitest |
| `pnpm test:watch` | Tests Vitest en mode watch |
| `pnpm package:win` | Packaging Windows (electron-builder) |

## Structure

```
src/
├── main/           # Processus principal Electron
│   └── index.ts
├── preload/        # Preload sécurisé (contextBridge)
│   └── index.ts
└── renderer/       # Interface React
    ├── index.html
    └── src/
        ├── App.tsx
        ├── App.test.tsx
        ├── main.tsx
        ├── global.d.ts
        └── styles.css
```

## Licence

Propriétaire — SCPT