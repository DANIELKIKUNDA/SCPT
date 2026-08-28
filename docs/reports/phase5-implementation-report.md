# SCPT — Rapport d’implémentation Phase 5

## Statut

Implémentation source terminée dans la baseline transmise par l’utilisateur. La validation dynamique finale reste à exécuter sur le poste Windows cible (Node 24 / Electron 33), car l’archive source exclut volontairement `node_modules` et l’environnement de travail utilisé pour cette modification ne dispose pas du registre npm.

## Périmètre implémenté

- root Remotion réutilisable ;
- composition projet déterministe en 1920×1080, 30 fps ;
- timeline `dureeMs → frames` ;
- scènes texte, formule KaTeX, image locale sécurisée, code, diagramme simple ;
- transitions `fade`, `slide-left`, `slide-right`, `none` ;
- thèmes de prévisualisation et adaptation de lisibilité au fond de scène ;
- lecteur `@remotion/player` avec lecture, pause, seek et retour au début ;
- prévisualisation scène et projet ;
- workspace éditeur réel : liste de scènes, lecteur, propriétés et bibliothèque média ;
- Monaco avec workers locaux, sans CDN ;
- protocole `scpt-media://` côté Electron main pour exposer uniquement les médias appartenant au projet ;
- migration SQLite conservatrice pour le type `diagramme` ;
- préservation de `scene.media_id` pendant l’autosauvegarde ;
- correction du nom de destination média en cas de collision ;
- watcher média relié au statut `manquante` en SQLite ;
- correction du contrat renderer/preload vers `window.electronAPI` ;
- sauvegarde explicite + autosauvegarde 1,5 s.

## Contrats Phase 5 couverts par tests source

- durée et conversion en frames ;
- timeline déterministe ;
- frame sans scène → erreur explicite ;
- formule KaTeX invalide → fallback contrôlé ;
- format 16:9 ;
- diagramme simple déterministe ;
- lisibilité thème/fond ;
- migration de scène vers `diagramme` sans perte des scènes existantes ;
- persistance `diagramme` ;
- association média conservée lors des updates/autosaves ;
- état transitoire : association média distincte de l’historique Undo ;
- CSP sans `unsafe-eval` et autorisation limitée de `scpt-media:`.

Le dépôt contient désormais environ 139 tests dans 22 fichiers de test (comptage statique des appels `it`/`test`). Ce nombre doit être confirmé par `pnpm test` sur Windows.

## Hors périmètre volontaire

Aucune fonctionnalité Phase 6+ n’est ajoutée : pas de Piper, narration audio, sous-titres, déclinaisons multi-format, `@remotion/renderer`, FFmpeg ou export MP4.

## Validation Windows obligatoire

Dans PowerShell, depuis le projet restauré :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
pnpm env:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Scénario visuel final : ouvrir/créer un projet, créer les cinq types de scènes Phase 5, éditer contenu/durée/fond/transition, associer une image, tester aperçu scène/projet et play/pause/seek, sauvegarder, fermer, rouvrir et vérifier la composition persistée.
