# 10 — Rapport de compatibilité des versions

## Contexte initial

Ce rapport est établi avant toute modification fonctionnelle du dépôt, sur la base du contenu actuel de `package.json` et de la structure présente.

### État du dépôt
- `package.json` existe et contient déjà un socle Electron + React + TypeScript.
- `pnpm-lock.yaml` est absent.
- `tsconfig.web.json` est référencé dans `tsconfig.json` mais n’existe pas.
- `electron.vite.config.ts` n’existe pas.
- Les dossiers `src/` et `docs/reference/` ne sont pas présents dans la racine observée.
- Aucun fichier de configuration ESLint/Prettier spécifique n’a été détecté.

## Versions candidates

| Élément | Version entrée | Résultat attendu | Statut | Décision | Commentaire |
|---|---:|---|---|---|---|
| pnpm | 9.15.3 (packageManager) | n/a | À vérifier | Utiliser uniquement pnpm | `pnpm install --frozen-lockfile` après initialisation |
| Node développement | à déterminer | n/a | À vérifier | Conserver une version compatible Windows 11 | Version du runtime à vérifier sur l’environnement de développement |
| Electron | 33.2.1 | 33.2.1 | À vérifier | Phase 0 | Dépendance de base du desktop Electron |
| React | 18.3.1 | 18.3.1 | À vérifier | Phase 0 | Interface renderer minimal |
| TypeScript | 5.7.3 | 5.7.3 | À vérifier | Phase 0 | TypeScript strict requis |
| electron-vite | 2.0.0 | 2.0.0 | À vérifier | Phase 0 | Build dev/production Electron + Vite |
| electron-builder | 25.0.0 | 25.0.0 | À vérifier | Phase 0 | Packaging Windows (installer) |
| Vite | 5.4.10 | 5.4.10 | À vérifier | Phase 0 | Bundler pour renderer/preload/main |
| `@vitejs/plugin-react` | 4.3.3 | 4.3.3 | À vérifier | Phase 0 | Intégration React dans Vite |
| ESLint | 9.14.0 | 9.14.0 | À vérifier | Phase 0 | Linting TypeScript/React |
| Prettier | 3.13.0 | 3.13.0 | À vérifier | Phase 0 | Formatage de code |
| Vitest | 2.1.8 | 2.1.8 | À vérifier | Phase 0 | Tests unitaires |

## Dépendances essentielles à installer / stabiliser en phase 0

- `electron`
- `electron-vite`
- `electron-builder`
- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `eslint`
- `@eslint/js`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `prettier`
- `vitest`
- `@vitest/coverage-v8`
- `jsdom`

## Phase 1 — Dépendances ajoutées

- `zod` (4.4.3) — validation des entrées IPC et préférences
- `pino` (10.3.1) — journalisation structurée
- `pino-pretty` (13.1.3, dev) — logs lisibles en développement

### Store de préférences

**Décision :** `conf` a été abandonné car incompatible ESM avec le main process Electron (CommonJS). `electron-store` v11 a le même problème. Un store JSON natif a été implémenté à la place.

**Caractéristiques du store JSON natif :**
- Fichier : `app.getPath('userData')/scpt-preferences.json`
- Écriture atomique : écriture dans `scpt-preferences.json.tmp`, puis `renameSync` vers le fichier cible
- Nettoyage automatique d'un `.tmp` abandonné
- JSON corrompu → warning log + réinitialisation aux valeurs par défaut
- Validation Zod à chaque lecture/écriture
- Valeurs par défaut : `{ theme: 'system', language: 'fr', reduceMotion: false }`
- Aucune dépendance externe, compatible CJS sans friction

## Plan précis de la phase 0

1. Normaliser la base du dépôt sans anticiper les phases suivantes.
2. Ajouter la structure minimale canonique :
   - `src/main/` pour le processus Electron principal ;
   - `src/preload/` pour l’API exposée au renderer ;
   - `src/renderer/` pour le point d’entrée React et un écran d’accueil minimal.
3. Créer les fichiers de configuration manquants :
   - `electron.vite.config.ts` ;
   - `tsconfig.web.json` ;
   - `eslint.config.js` ou `eslint.config.ts` ;
   - `prettier.config.mjs` ;
   - éventuellement `vite.config.ts` si requis par la configuration Electron Vite.
4. Conserver `package.json` comme point de départ, puis passer aux versions exactes et au lockfile `pnpm-lock.yaml`.
5. Prévoir un écran d’accueil sécurisé dans le renderer, sans logique métier autre que la vérification du pont preload.
6. Préparer les scripts de validation : `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Observations importantes

- `package.json` est déjà proche d’un socle de phase 0, mais il contient des intervalles de version (`^`) qui doivent être verrouillés.
- La présence d’un `packageManager` pinne `pnpm@9.15.3`, ce qui est cohérent avec l’exigence pnpm.
- La création du `pnpm-lock.yaml` est indispensable pour respecter la procédure de verrouillage des versions.
- La phase 0 doit rester strictement limitée à l’initialisation du dépôt. Aucun code métier de phases suivantes ne doit être ajouté.

## Checklist de la phase 0 (avant modification)

- [ ] Vérifier et créer `pnpm-lock.yaml`.
- [ ] Installer les dépendances de phase 0 avec pnpm.
- [ ] Ajouter les fichiers de configuration manquants.
- [ ] Construire le socle Electron + React + TypeScript.
- [ ] Assurer la sécurité de la fenêtre Electron (`contextIsolation`, `nodeIntegration: false`).
- [ ] Documenter l’écran d’accueil minimal.
- [ ] Générer une version initiale du projet qui passe `tsc --noEmit`.
- [ ] Préparer les scripts de build et test.
