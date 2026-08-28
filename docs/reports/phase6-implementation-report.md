# SCPT — Phase 6 — Narration locale

## Statut

Implémentation source complète de la Phase 6, construite sur la baseline Phase 5 figée et sur le preflight Windows Phase 6 validé.

La certification finale `pnpm typecheck / lint / test / build / dev` doit être rejouée sur le poste Windows canonique, car l’environnement de construction de cette archive ne contient pas `node_modules` ni pnpm et n’est pas Windows.

## Périmètre implémenté

- agrégat `PisteNarration` ;
- segments/pris​es de narration ;
- `PisteNarrationId` ;
- repository narration ;
- tables SQLite `narration_tracks` et `narration_segments` ;
- import WAV/MP3 local ;
- copie sans écrasement ;
- détection réelle du type ;
- checksum SHA-256 ;
- métadonnées et durée audio ;
- génération locale via Piper ;
- voix française `fr_FR-siwis-medium` ;
- exécution Piper via `execa` avec `shell:false` ;
- timeout ;
- annulation ciblée via `AbortController` ;
- file de génération `p-queue` avec concurrence 1 ;
- limitation des analyses audio via `p-limit` ;
- sélection persistante de la prise finale ;
- lecture sécurisée via IPC/preload ;
- WaveSurfer chargé paresseusement dans le renderer ;
- waveform, play/pause et retour au début ;
- panneau Narration intégré dans le panneau inférieur de l’éditeur ;
- onglets Narration / Médias ;
- création canonique des dossiers `audio/narration`, `audio/music`, `audio/temp`.

## Modèle métier retenu

Le document canonique définit `PisteNarration.segments` et `priseFinaleId`, mais ne définit pas de table ou entité `NarrationTake` séparée. Pour ne pas inventer une troisième structure de persistance hors contrat, le MVP Phase 6 représente chaque prise générée/importée comme un `SegmentNarration` candidat. `priseFinaleId` référence le segment retenu.

Chaque prise conserve : texte, scène facultative, fichier audio relatif, durée, ordre, statut, source (`piper` ou `import`), voix, checksum et date de création.

## Sécurité

- aucune commande shell concaténée ;
- Piper est appelé avec arguments séparés et `shell:false` ;
- aucun accès Node/fs/Piper dans React ;
- import audio via `dialog.showOpenDialog` dans le main ;
- chemins audio persistés relativement au projet ;
- lecture audio validée contre le répertoire projet ;
- source importée jamais écrasée ;
- fichiers temporaires distincts des prises finales ;
- un fichier Piper annulé/échoué n’est jamais promu comme prise valide ;
- aucune modification CSP nécessaire ;
- aucune fonctionnalité de Phase 7 ajoutée.

## Compatibilité Electron

`execa`, `p-queue`, `p-limit`, `file-type` et `music-metadata` sont bundlés dans le main via `electron-vite` afin d’éviter une externalisation CommonJS incompatible avec leurs distributions ESM.

La version `execa@9.6.1` reste figée conformément au preflight : elle est compatible avec Node 24 de développement et le Node 20.18.3 embarqué dans Electron 33.4.11.

## Ressources Piper

Les binaires, le modèle français, les checksums, origines et licences restent documentés dans `resources/PIPER-SOURCES.md` et ne sont pas téléchargés automatiquement par l’application.

## Tests ajoutés

Les tests Phase 6 ajoutés couvrent notamment (20 nouveaux cas, portant la suite source attendue de 139 à 159 tests dans 27 fichiers) :

- invariants de `PisteNarration` ;
- ajout/régénération de prises ;
- sélection finale ;
- version texte et invalidation de la prise finale lorsque le texte change ;
- conservation d’une prise finale valide lors d’une nouvelle prise sur le même texte ;
- persistance SQLite fermeture/réouverture ;
- changement de prise finale et de durée ;
- texte vide rejeté avant génération ;
- import audio ;
- copie WAV réelle et source préservée ;
- collision de nom ;
- traversal de chemin refusé ;
- Piper absent.

Les preuves Windows de génération WAV réelle, annulation < 3 s, absence de processus orphelin, timeout, WaveSurfer Electron et play/pause/seek proviennent du preflight Phase 6 déjà validé.

## Limitation déclarée

La Phase 6 ne réalise pas le mixage final de narration dans un MP4. Le rendu final et FFmpeg appartiennent aux Phases 9 et 10. La Phase 7 (sous-titres) n’est pas commencée.
