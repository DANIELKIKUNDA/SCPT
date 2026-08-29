# SCPT — Rapport de préflight Phase 9 (Rendu Remotion Windows)

## Statut

**PREFLIGHT PHASE 9 DÉFINITIVEMENT VALIDÉ** — le spike technique a prouvé, sur le vrai
Windows (`C:\Dev\SCPT`), que Remotion bundle une source, démarre un renderer headless,
produit une vraie vidéo intermédiaire et la restitue comme un fichier valide.

Aucune fonctionnalité métier définitive de Phase 9 n'a été implémentée.
Aucune fonctionnalité de Phase 10 (FFmpeg explicite) n'a été ajoutée.

## Versions exactes

| Package | Version |
|---|---|
| `@remotion/renderer` | **4.0.0** |
| `@remotion/bundler` | **4.0.0** |
| `remotion` (déjà verrouillé) | 4.0.0 |
| `@remotion/player` (déjà verrouillé) | 4.0.0 |

### Compatibilité vérifiée

- `@remotion/renderer@4.0.0` dépend exactement de `remotion@4.0.0` (pas de range).
- `@remotion/bundler@4.0.0` dépend exactement de `remotion@4.0.0` (pas de range).
- Les deux déclarent `peerDependencies` `react >=16.8.0` / `react-dom >=16.8.0`
  (satisfaites par `react@18.3.1` / `react-dom@18.3.1`).
- `@remotion/renderer@4.0.0` installe en dépendance optionnelle
  `@remotion/compositor-win32-x64-msvc@4.0.0` (FFmpeg 6.0 embarqué, offline).

## Résultats du preflight

| Contrôle | Résultat |
|---|---|
| Bundle Remotion (`@remotion/bundler`) | PASS |
| Vrai rendu Windows (`@remotion/renderer`) | PASS |
| Fichier produit | `render-test.mp4`, 108 200 octets |
| Durée réelle (ffprobe) | 3,000 s |
| Résolution réelle (ffprobe) | 1920×1080, 30/1 fps, 90 frames, h264/libx264 |
| Chromium / headless | PASS (Chrome local, aucun processus orphelin) |
| Fonctionnement offline | PASS (aucun téléchargement, pas de cache `.remotion` créé) |
| Chemins Windows avec espaces | PASS (`C:\Dev\SCPT Render Test\...`) |
| Progression réelle | PASS (101 échantillons, 0 % → 100 %) |
| Annulation | PASS (`renderMedia() got cancelled`, sortie partielle supprimée) |
| Aucun browser orphelin | PASS |
| Erreur contrôlée | PASS (composition inexistante → erreur capturée, pas de crash) |
| Double rendu | PASS (2 sorties distinctes, aucune fuite de processus) |
| Rendu 16:9 | PASS |
| Rendu 9:16 | PASS (`vertical.mp4`, 1080×1920, 2,000 s, 60 frames) |
| Déterminisme | PASS (90==90 frames, 1920×1080, 3,000 s ; SHA-256 identiques) |
| Compatibilité main Electron | PASS (4/4) |
| Nettoyage temporaires | PASS |

## Mécanismes techniques identifiés

### Navigateur (Chromium)

`@remotion/renderer@4.0.0` embarque un Puppeteer vendored. Sa résolution du navigateur
(`get-local-browser-executable.js`) suit cet ordre :

1. option `browserExecutable` fournie ;
2. variable d'environnement `PUPPETEER_EXECUTABLE_PATH` ;
3. Chrome local — Windows : `C:\Program Files\Google\Chrome\Application\chrome.exe`
   puis `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe` ;
4. binaire « Thorium 107 » (révision `1002410`) déjà téléchargé dans
   `node_modules\.remotion\.chromium\win64-1002410\Thorium_107.0.5271.0\BIN\thorium.exe` ;
5. sinon téléchargement automatique depuis
   `https://remotionchromium-binaries.s3.eu-central-1.amazonaws.com/thorium-107.zip`.

Sur cette machine, Chrome local est présent : **aucun téléchargement silencieux** n'a lieu.
Pour garantir l'offline, le preflight passe explicitement `browserExecutable` pointant vers
le Chrome local, et vérifie qu'aucun cache `.remotion` n'est créé.

### Encodeur FFmpeg (intermédiaire)

`@remotion/renderer` encode via `@remotion/compositor-win32-x64-msvc` (FFmpeg 6.0
`Lavc60/Lavf60` embarqué). `ffmpeg.exe`/`ffprobe.exe` sont dans
`ffmpeg/remotion/bin/` et les DLL dans `ffmpeg/remotion/lib/` ; Remotion ajoute
`<pkg>/ffmpeg/remotion/lib` au `PATH` avant d'exécuter les binaires. **Aucun FFmpeg
Phase 10 n'est nécessaire pour produire la vidéo intermédiaire.**

### better-sqlite3 sous Electron

Electron 33.4.11 embarque Node 20.18.3 (ABI 130) ; les tests tournent sous Node 24
(ABI 137). Le mécanisme existant de double binaire (`swap-sqlite-binary.mjs`) est
**obligatoire** : avant un lancement Electron, le binaire actif doit être le binaire
ABI 130 (`pnpm dev` le fait via `predev`). Le preflight a confirmé que
`@remotion/bundler` et `@remotion/renderer` se chargent et s'exécutent dans le vrai
processus main Electron sans conflit avec `better-sqlite3` (une fois le bon binaire actif).

## Contrôles finaux

- `pnpm env:check` : PASS
- `pnpm typecheck` : PASS
- `pnpm lint` : PASS, 0 warning
- `pnpm test` : 241/241 PASS, 41/41 fichiers
- `pnpm build` : PASS
- `pnpm dev` (vrai Electron) : PASS, 0 unhandled error

## Fichiers permanents ajoutés/modifiés

- `package.json` — ajout de `@remotion/bundler@4.0.0` et `@remotion/renderer@4.0.0`.
- `pnpm-lock.yaml` — graphe pnpm mis à jour (dépendances exactes verrouillées).

Aucun fichier `src/` n'a été modifié. Les fichiers temporaires du spike
(`temp/phase9-preflight/`, `C:\Dev\SCPT Render Test\`) ont été supprimés.

## Risques / contraintes découvertes

- Le premier bundle Remotion (webpack 5.83.1) est lent (~2 min sur cette machine) ;
  les bundles suivants profitent du cache et sont nettement plus rapides.
- Le rendu doit disposer d'un Chrome local **ou** d'un téléchargement préalable de
  Thorium 107 réalisé comme opération de build/développement, jamais comme
  téléchargement automatique en utilisation offline.
- `isUserCancelledRender` n'est **pas** une export publique de
  `@remotion/renderer@4.0.0` ; l'annulation se détecte via le message
  `"renderMedia() got cancelled"` (ou via `makeCancelSignal()` + l'état local).
- Le swap du binaire natif `better-sqlite3` Node/Electron doit rester en place
  (ABI 137 vs ABI 130).
