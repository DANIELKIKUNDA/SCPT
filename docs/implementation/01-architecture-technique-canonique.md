# 01 — Architecture technique canonique

## 1. Décision principale

Le SCPT est une application de bureau construite avec :

```text
Electron
+ React
+ TypeScript
+ electron-vite
+ Remotion
+ FFmpeg
+ Piper
+ SQLite
```

Le gestionnaire de paquets officiel est :

```text
pnpm
```

## 2. Pourquoi pnpm

pnpm est retenu parce qu’il offre :

- un lockfile strict ;
- des installations reproductibles ;
- une bonne économie d’espace disque ;
- des commandes rapides ;
- une gestion claire des dépendances ;
- une évolution possible vers un workspace sans imposer un monorepo dès le départ.

Le projet initial reste un **dépôt unique avec un seul package principal**.

## 3. Processus Electron

### `main`

Le processus principal constitue le backend local.

Responsabilités :

- cycle de vie de l’application ;
- fenêtres ;
- accès sécurisé au système de fichiers ;
- base SQLite ;
- exécution de FFmpeg ;
- exécution de Piper ;
- orchestration de Remotion ;
- tâches longues ;
- journalisation ;
- sécurité des chemins ;
- stockage des secrets ;
- IPC.

### `preload`

Responsabilités :

- exposer une API minimale au renderer ;
- valider les entrées et sorties ;
- masquer Node.js ;
- fournir des contrats typés ;
- empêcher l’accès direct à `fs`, `child_process` et SQLite depuis React.

### `renderer`

Le renderer contient l’interface React.

Responsabilités :

- écrans ;
- formulaires ;
- éditeur de scènes ;
- timeline ;
- lecteur de prévisualisation ;
- affichage des tâches ;
- notifications ;
- état d’interface.

Il ne doit pas :

- ouvrir directement SQLite ;
- exécuter FFmpeg ;
- exécuter Piper ;
- écrire librement sur le disque ;
- contenir les invariants métier.

## 4. Couches

```text
interfaces
→ application
→ domain
← infrastructure
```

### Domaine

Contient :

- agrégats ;
- entités ;
- value objects ;
- invariants ;
- événements ;
- contrats de repositories ;
- contrats de ports.

### Application

Contient :

- cas d’usage ;
- commandes ;
- requêtes ;
- DTO ;
- mappers ;
- orchestration ;
- transactions ;
- idempotence.

### Infrastructure

Contient :

- SQLite ;
- Drizzle ;
- système de fichiers ;
- FFmpeg ;
- Piper ;
- Remotion ;
- logs ;
- stockage des secrets ;
- adaptateurs IPC.

### Interfaces

Contient :

- handlers IPC ;
- API preload ;
- composants React ;
- pages ;
- vues ;
- présentateurs.

## 5. Dépendances de production

Les versions exactes sont verrouillées dans `pnpm-lock.yaml`. Elles doivent être ajoutées par phase et non toutes installées au premier jour.

### Noyau Electron

- `electron` — runtime desktop ;
- `electron-vite` — développement et build main/preload/renderer ;
- `electron-builder` — installateur Windows ;
- `react` — interface ;
- `react-dom` — rendu React ;
- `react-router-dom` — navigation interne.

### Validation et contrats

- `zod` — validation des commandes, IPC, configuration et DTO ;
- `ulid` — identifiants ordonnables ;
- `date-fns` — calculs et affichage de dates.

### État et formulaires

- `zustand` — état d’interface ;
- `react-hook-form` — formulaires ;
- `@hookform/resolvers` — intégration Zod.

### Interface et ergonomie

- `tailwindcss` — styles utilitaires ;
- `@tailwindcss/vite` — intégration Vite ;
- `lucide-react` — icônes ;
- `class-variance-authority` — variantes de composants ;
- `clsx` — classes conditionnelles ;
- `tailwind-merge` — fusion sûre des classes ;
- `sonner` — notifications ;
- `react-resizable-panels` — panneaux redimensionnables ;
- `@dnd-kit/core` — glisser-déposer ;
- `@dnd-kit/sortable` — réordonnancement des scènes ;
- `@dnd-kit/utilities` — utilitaires DnD.

### Édition spécialisée

- `@monaco-editor/react` — éditeur de code ;
- `katex` — formules ;
- `react-katex` — intégration React de KaTeX ;
- `wavesurfer.js` — forme d’onde et repères audio ;
- `recharts` — graphiques pédagogiques simples.

### Vidéo et rendu

- `remotion` — composition et rendu ;
- `@remotion/player` — prévisualisation React ;
- `@remotion/renderer` — rendu depuis le processus principal ;
- `@remotion/bundler` — bundle des compositions ;
- `@remotion/media-utils` — durées et métadonnées utiles ;
- `execa` — exécution contrôlée des processus ;
- `ffmpeg-static` — binaire FFmpeg embarqué ;
- `ffprobe-static` — binaire FFprobe embarqué.

### Stockage local

- `better-sqlite3` — moteur SQLite local ;
- `drizzle-orm` — mapping SQL typé ;
- `drizzle-kit` — migrations ;
- `fs-extra` — opérations de fichiers contrôlées ;
- `file-type` — détection réelle du type de fichier ;
- `mime-types` — gestion MIME ;
- `proper-lockfile` — verrouillage des fichiers de projet ;
- `keytar` — secrets dans le coffre du système d’exploitation.

### Stockage des préférences (Phase 1)

**Décision :** Un store JSON natif a été retenu à la place de `conf` (incompatible ESM avec le main process Electron CommonJS).

**Caractéristiques :**
- Fichier : `app.getPath('userData')/scpt-preferences.json`
- Écriture atomique via fichier temporaire + `renameSync`
- Validation Zod à chaque lecture/écriture
- Récupération automatique après JSON corrompu (valeurs par défaut)
- Valeurs par défaut : `{ theme: 'system', language: 'fr', reduceMotion: false }`
- Aucune dépendance externe

### Médias

- `sharp` — miniatures et transformations d’images ;
- `music-metadata` — métadonnées audio ;
- `p-limit` — limitation de concurrence ;
- `p-queue` — file locale de tâches ;
- `chokidar` — observation contrôlée de fichiers ;
- `sanitize-filename` — noms de fichiers sûrs.

### Journalisation

- `pino` — logs structurés ;
- `pino-pretty` — affichage lisible en développement.

## 6. Dépendances de développement

- `typescript`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@types/better-sqlite3`
- `@types/fs-extra`
- `@types/mime-types`
- `vitest`
- `@vitest/coverage-v8`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@playwright/test`
- `eslint`
- `@eslint/js`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `prettier`
- `husky`
- `lint-staged`
- `cross-env`
- `tsx`

## 7. Dépendances volontairement absentes

Ne pas ajouter sans décision explicite :

- Redux ;
- NestJS ;
- Fastify ;
- Express ;
- Prisma ;
- TypeORM ;
- GraphQL ;
- tRPC ;
- Docker ;
- Redis ;
- Kafka ;
- service cloud ;
- framework de microservices ;
- bibliothèque d’authentification multi-utilisateur.

## 8. Base de données

SQLite est utilisé pour :

- projets ;
- scènes ;
- références média ;
- pistes de narration ;
- sous-titres ;
- déclinaisons ;
- rendus ;
- exports ;
- historique ;
- tâches.

Les fichiers lourds restent sur le système de fichiers.

Drizzle est utilisé pour :

- schémas ;
- migrations ;
- requêtes typées ;
- transactions.

## 9. Rendu

### Remotion

Responsable de :

- composition React ;
- animations ;
- textes ;
- formules ;
- code ;
- diagrammes ;
- transitions ;
- images ;
- vidéos ;
- sous-titres intégrés.

### FFmpeg

Responsable de :

- inspection ;
- conversion ;
- extraction audio ;
- normalisation ;
- concaténation si nécessaire ;
- mixage ;
- transcodage ;
- vérification ;
- MP4 final.

### Piper

Responsable de :

- synthèse vocale locale ;
- génération WAV ;
- choix du modèle de voix ;
- fonctionnement hors ligne.

Piper est fourni comme binaire et modèles locaux. Il n’est pas importé comme bibliothèque JavaScript.

## 10. IPC

Chaque canal IPC doit posséder :

- un nom canonique ;
- un schéma Zod d’entrée ;
- un schéma Zod de sortie ;
- un handler main ;
- une méthode preload ;
- un appel renderer ;
- un test.

Exemple :

```text
project:create
project:open
project:save
media:import
voice:generate
render:start
render:cancel
render:status
export:open-folder
```

## 11. Sécurité Electron

Configuration obligatoire :

```text
contextIsolation: true
nodeIntegration: false
sandbox: true lorsque compatible
webSecurity: true
```

Interdictions :

- `remote` ;
- `eval` ;
- exposition de Node dans `window` ;
- chemins non validés ;
- commandes shell concaténées ;
- secrets dans le renderer.

## 12. Politique d’installation

Installer les dépendances à la phase où elles deviennent nécessaires.

Exemple :

```bash
pnpm add react react-dom react-router-dom zod zustand
pnpm add -D electron electron-vite electron-builder typescript
```

Puis, lors de la phase de stockage :

```bash
pnpm add better-sqlite3 drizzle-orm fs-extra
pnpm add -D drizzle-kit @types/better-sqlite3
```

Et lors de la phase vidéo :

```bash
pnpm add remotion @remotion/player @remotion/renderer @remotion/bundler
pnpm add execa ffmpeg-static ffprobe-static
```

## 13. Gestion des modules natifs

`better-sqlite3`, `sharp` et `keytar` peuvent nécessiter une reconstruction Electron.

Le build doit utiliser les mécanismes d’`electron-builder` et tester l’installation Windows réelle.

Aucune phase n’est validée tant que les modules natifs ne fonctionnent pas dans l’application packagée.

## 14. Politique de versions

- exact versions enregistrées dans le lockfile ;
- aucun `*` ;
- pas de mise à jour automatique majeure ;
- mise à jour d’une dépendance dans une branche dédiée ;
- exécution complète des tests avant fusion ;
- documentation du motif de mise à jour.

## 15. Critère d’architecture

La pile est acceptée lorsque :

- le renderer ne peut pas accéder directement à Node ;
- SQLite fonctionne dans l’application packagée ;
- Remotion rend une scène ;
- FFmpeg produit un MP4 ;
- Piper produit un WAV ;
- l’IPC est typé ;
- les tests s’exécutent avec `pnpm test`.
