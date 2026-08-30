# SCPT — Rapport de préflight Phase 10 (FFmpeg + FFprobe + MP4 final)

## Statut

**PREFLIGHT PHASE 10 DÉFINITIVEMENT VALIDÉ** — les risques techniques FFmpeg/FFprobe
ont été levés sur le vrai Windows (`C:\Dev\SCPT`) : un intermédiaire Phase 9 + une
narration WAV ont été réellement mixés en MP4 H.264/AAC, vérifiés objectivement par
ffprobe JSON, avec normalisation loudnorm, annulation/timeout contrôlés et absence de
processus orphelins.

Aucune fonctionnalité métier définitive de Phase 10 n'a été implémentée.
Aucune fonctionnalité de Phase 11 n'a été implémentée.

## Versions exactes

| Package | Version |
|---|---|
| `ffmpeg-static` | **5.3.0** |
| `ffprobe-static` | **3.1.0** |

`pnpm.onlyBuiltDependencies` a été complété avec `ffmpeg-static` (son script `install`
télécharge le binaire à l'installation).

## Binaires réels

| Élément | Valeur |
|---|---|
| `ffmpeg.exe` | **FFmpeg 6.1.1-essentials_build-www.gyan.dev** (2023, gcc 12.2.0/MSYS2) |
| `ffprobe.exe` | **FFprobe 4.0.2** (2018, gcc 7.3.1) |
| Origine | `ffmpeg-static` télécharge le build Windows gyan.dev (`b6.1.1`) à l'install ; `ffprobe-static` embarque ses binaires dans le tarball npm |
| Licence ffmpeg | GPL-3.0-or-later (`--enable-gpl --enable-version3`) |
| Licence ffprobe-static | MIT (paquet) — le binaire ffprobe 4.0.2 est lui aussi compilé avec `--enable-gpl` |
| libx264 | présent |
| AAC (encodeur natif) | présent |
| loudnorm | présent |
| yuv420p | présent |
| SHA-256 `ffmpeg.exe` | `04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00` |
| SHA-256 `ffprobe.exe` | `4303ec85855340689b1f8aa5d9c1dc06ef3e3090682de3034edc3fca2b0798d5` |

**Signalement licence** : `ffmpeg.exe` est un build GPL (`--enable-gpl --enable-version3`)
avec de nombreux codecs activés (libx264, libx265, libaom, libvpx, etc.). La distribution
du binaire GPL devra être traitée en Phase 14 ; ce rapport documente les faits techniques
sans conclure juridiquement.

## Résultats du preflight (22/22 Node + 5/5 Electron)

| Contrôle | Résultat |
|---|---|
| runtime offline | PASS (binaires locaux, aucun téléchargement runtime) |
| entrée réelle Phase 9 | PASS (intermédiaire Remotion 1920×1080, 3 s) |
| narration WAV réelle | PASS (22050 Hz, 3 s) |
| execa → ffmpeg | PASS (`shell:false`, exit 0) |
| execa → ffprobe | PASS (`shell:false`, exit 0) |
| H.264 (libx264) | PASS |
| AAC 48 kHz | PASS |
| yuv420p | PASS |
| 30 fps | PASS |
| loudnorm | PASS (sortie 48 kHz valide, pas de clipping signalé) |
| MP4 final technique réel | PASS (`final-16x9.mp4`, h264/yuv420p/1920×1080@30/1 + aac@48000) |
| ffprobe JSON | PASS (parseur déterministe, tous champs vérifiés) |
| synchronisation audio/vidéo | PASS (normal Δ=0,00 s ; écart fabriqué Δ=3,00 s détecté) |
| 16:9 | PASS (1920×1080) |
| 9:16 | PASS (1080×1920) |
| chemins Windows espaces/accents/& | PASS |
| fichier corrompu | PASS (ffprobe rejette un MP4 tronqué) |
| ffmpeg absent | PASS (erreur contrôlée, pas de crash) |
| ffprobe absent | PASS (erreur contrôlée, pas de crash) |
| sortie immuable | PASS (`-n` ne remplace pas, « already exists » détectable) |
| checksum SHA-256 | PASS (64 hex, stable) |
| annulation FFmpeg | PASS (AbortSignal, aucun ffmpeg orphelin) |
| timeout | PASS (2 s, aucun résiduel) |
| write failure sûr | PASS (destination impossible → erreur, pas de « termine ») |
| vrai main Electron | PASS (5/5 : better-sqlite3 ABI 130, résolution chemins, execa 9.6.1, ffmpeg/ffprobe, shell API) |
| résolution binaire après build | PASS (dépendances CJS externalisées → `require` depuis node_modules) |
| aucun processus orphelin | PASS |
| cleanup temporaires | PASS |
| capacité ouverture dossier | PASS (`shell.openPath` + `shell.showItemInFolder`) |

## Contraintes / risques découverts

- **Détection de non-écrasement** : `ffmpeg-static` 5.3.0 (gyan.dev) retourne
  **exit code 0** même quand `-n` refuse d'écraser ; la sortie « File … already exists.
  Exiting. » est écrite sur stderr. La future Phase 10 ne doit pas se fier au seul code
  de sortie : vérifier stderr (« already exists ») et/ou le checksum du fichier existant.
- **Version ffprobe** : `ffprobe-static@3.1.0` embarque un ffprobe ancien (4.0.2), alors
  que `ffmpeg-static@5.3.0` fournit FFmpeg 6.1.1. La lecture MP4/H.264/AAC reste fiable ;
  à surveiller si des métadonnées plus récentes deviennent nécessaires.
- **Packaging** : les binaires sont des fichiers locaux dans `node_modules` (jamais d'URL).
  `electron-builder` devra embarquer ces binaires (~83 Mo + ~63 Mo) ; la stratégie exacte
  (extraResources vs node_modules) reste à définir en Phase 10, pas ici.
- **execa 9.6.1** est ESM-only : utilisable dans le main Electron via `import('execa')`
  (validé), pas via `require`.

## Non-régression

- `pnpm env:check` : PASS
- `pnpm typecheck` : PASS
- `pnpm lint` : PASS, 0 warning
- `pnpm test` : 280/280 PASS (49/49 fichiers)
- `pnpm build` : PASS
- `pnpm dev` (vrai Electron) : PASS

## Fichiers permanents ajoutés/modifiés

- `package.json` — ajout de `ffmpeg-static@5.3.0`, `ffprobe-static@3.1.0` et de
  `ffmpeg-static` dans `pnpm.onlyBuiltDependencies`.
- `pnpm-lock.yaml` — verrouillé.
- `docs/reports/phase10-preflight-report.md` — ce rapport.

Aucun fichier `src/` modifié. Tous les artefacts temporaires du spike ont été supprimés.
