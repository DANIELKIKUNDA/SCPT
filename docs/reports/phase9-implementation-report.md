# SCPT — Rapport d’implémentation Phase 9

## Statut

**Implémentation principale terminée — certification Windows requise avant gel définitif.**

Baseline de départ : Phase 8 validée sur Windows avec 41/41 fichiers de tests et 241/241 tests PASS, puis preflight Phase 9 définitivement validé sur Windows avec `@remotion/renderer@4.0.0` et `@remotion/bundler@4.0.0`, rendu réel 16:9 et 9:16, progression réelle, annulation, absence de processus orphelin et compatibilité main Electron 33.

La Phase 9 reste strictement limitée au **rendu intermédiaire Remotion**. Aucune fonctionnalité de Phase 10 (`ffmpeg-static`, `ffprobe-static`, mixage final, normalisation audio, export MP4 final vérifié) n’est implémentée.

## Contrat Phase 9 couvert

Le plan canonique exige : bundle, file de tâches, progression, annulation, reprise, tentative, logs, fichiers temporaires et limite de concurrence, avec tests de succès, échec, annulation, double demande, fermeture application et relance.

L’implémentation couvre :

- agrégat métier `ExportAudiovisuel` et cycle d’état du rendu ;
- identifiant `ExportId` et empreinte des versions sources ;
- persistance SQLite `render_jobs` ;
- use cases de demande, liste et relance ;
- rejet d’une double demande active pour la même déclinaison ;
- queue locale unique `p-queue` avec concurrence 1 ;
- bundle Remotion réutilisable via `@remotion/bundler` ;
- rendu réel via `@remotion/renderer` ;
- progression issue du vrai renderer et persistée sans écriture à chaque frame ;
- annulation ciblée par `AbortController` + `makeCancelSignal()` ;
- reprise d’un rendu interrompu comme nouvelle tentative ;
- logs JSONL append-only ;
- temporaires isolés sous `temp/rendering/` et nettoyables ;
- sortie intermédiaire immuable sous `renders/previews/` ;
- SHA-256 de la sortie intermédiaire ;
- résolution offline du navigateur compatible ;
- construction sécurisée des `inputProps` Remotion depuis le projet ;
- images locales transportées vers Chromium headless en `data:` sans accès arbitraire au filesystem ;
- sous-titres validés uniquement ;
- narration finale exigée comme précondition métier sans anticiper le mixage Phase 10 ;
- IPC/preload typés ;
- panneau **Rendus** intégré au workspace ;
- fermeture projet et fermeture application coordonnées avec les rendus actifs ;
- récupération automatique des rendus interrompus à la réouverture.

## Machine d’état

`ExportAudiovisuel` utilise les statuts :

`demande → en_attente → en_preparation → en_composition → en_encodage → en_verification → termine`

avec terminaux alternatifs `echoue` et `annule`.

La progression est monotone, bornée à 0–100 et persiste les grandes étapes. Une sortie `termine` exige un chemin relatif projet, un checksum SHA-256 et une progression à 100 %.

## Reprise et tentatives

Une fermeture contrôlée n’enregistre pas artificiellement un rendu actif comme échec. Les jobs en cours reviennent à `en_attente` avec tentative incrémentée et diagnostic de reprise. À la prochaine ouverture du projet, `recoverProject()` programme leur reprise.

Une relance utilisateur n’est autorisée qu’après `echoue` ou `annule`. La nouvelle tentative conserve l’identité du job tout en incrémentant `tentative` et en rafraîchissant l’empreinte des sources.

## File de rendu et concurrence

Une seule instance `RenderJobCoordinator` est partagée par les projets ouverts. Sa queue `p-queue` est configurée avec `concurrency: 1`, conformément à la limite de concurrence Phase 9 et aux contraintes d’un poste Windows local.

Les jobs déjà planifiés sont protégés par un `Set` afin d’éviter une double insertion de la même tâche. Une double demande métier active sur une même déclinaison est en outre refusée au niveau du use case.

## Bundle et navigateur offline

`RemotionRenderAdapter` encapsule `bundle()`, `selectComposition()` et `renderMedia()` derrière `MoteurRenduPort`. Le domaine n’importe jamais Remotion.

Le bundle code-only est mémorisé et réutilisé tant que l’entry point ne change pas. Il est supprimé lors de la fermeture propre du moteur.

La résolution du navigateur est strictement infrastructure : navigateur local compatible ou ressource locale préparée. Aucun téléchargement silencieux n’est déclenché par SCPT pendant un rendu. En absence de navigateur utilisable, une erreur contrôlée est produite.

## Fichiers temporaires, logs et sortie immuable

Chaque tentative possède un dossier dédié :

`temp/rendering/<jobId>/attempt-<n>/`

La sortie temporaire `intermediate.mp4` n’est promue vers `renders/previews/` qu’après succès du renderer. La promotion refuse l’écrasement d’un fichier déjà présent. Un checksum SHA-256 est calculé après commit.

Les logs sont append-only sous :

`logs/render-<jobId>.jsonl`

et n’exigent pas de handle persistant.

## Intégrité des sources Phase 8

Avant rendu, le coordinator vérifie :

- présence de la déclinaison ;
- déclinaison non obsolète ;
- statut `pret_pour_rendu` ;
- version actuelle du projet maître identique à celle mémorisée dans le job ;
- version actuelle de la déclinaison identique à celle mémorisée dans le job.

La Phase 9 ne doit pas elle-même rendre les déclinaisons obsolètes. Un test de non-régression confirme que les changements de progression de `render_jobs` ne modifient pas l’empreinte sémantique du projet maître.

## Payload Remotion

`ProjectRenderPayloadBuilder` reconstruit les `ProjectCompositionProps` depuis les repositories métier. Les chemins projet sont validés contre les échappements `..`, chemins absolus et séparateurs non canoniques.

Les images nécessaires au rendu headless sont lues uniquement côté infrastructure main et converties en URL `data:`. Le renderer React ne reçoit ni `fs`, ni SQLite, ni chemin arbitraire machine.

Une piste de sous-titres renseignée doit être `validee`. Une narration finale validée et son fichier audio doivent exister ; la Phase 9 ne mixe cependant pas encore cette piste dans le fichier intermédiaire : le mixage audio final appartient à la Phase 10.

## Sécurité Electron

Le flux reste :

`React → preload → IPC → use cases / coordinator → repositories / adapters`.

Aucune modification n’est apportée à `contextIsolation`, `nodeIntegration`, `sandbox`, `webSecurity` ou à la CSP. Aucun import Node interdit n’est présent dans `src/renderer`.

Les entrées IPC de rendu sont validées avec Zod côté main et le preload n’expose que les méthodes ciblées : liste, démarrage, annulation, relance et lecture de log.

## UI

Le workspace expose un panneau **Rendus** avec :

- déclinaisons prêtes pour rendu ;
- action de lancement ;
- état de la file ;
- progression réelle persistée ;
- tentative courante ;
- annulation ;
- relance d’un échec/annulation ;
- sortie relative du projet ;
- checksum ;
- diagnostic/log ;
- rafraîchissement périodique tant qu’un rendu est actif.

Aucun chemin absolu Windows n’est affiché au renderer.

## Tests ajoutés Phase 9

Les nouveaux tests couvrent notamment :

- invariants et transitions de `ExportAudiovisuel` ;
- sortie immuable et checksum ;
- relance et reprise ;
- use cases demande/double demande/source obsolète/retry ;
- repository SQLite `render_jobs` ;
- filesystem de rendu, logs, nettoyage et protection de chemin ;
- résolution navigateur offline ;
- construction du payload Remotion ;
- coordinator succès, échec, annulation, concurrence, fermeture et relance ;
- panneau UI Rendus ;
- non-obsolescence du projet maître lors d’une simple progression de rendu.

## Contrôles effectués dans l’environnement d’implémentation

Contrôles structurels finaux :

- 195 fichiers TypeScript/TSX analysés ;
- 0 erreur de parsing TypeScript/TSX ;
- 0 import relatif manquant ;
- 0 import Node interdit détecté dans `src/renderer` ;
- 49 fichiers de tests présents ;
- 280 cas `it()` / `test()` recensés ;
- `@remotion/renderer@4.0.0` et `@remotion/bundler@4.0.0` déjà présents dans la baseline post-preflight ;
- `package.json` et `pnpm-lock.yaml` non modifiés par l’implémentation principale ;
- aucune dépendance Phase 10 (`ffmpeg-static`, `ffprobe-static`) ajoutée ;
- aucun import ou wrapper Phase 10 ajouté.

L’environnement d’implémentation n’est pas le Windows cible et ne contient pas son `node_modules`. Les gates `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` et le vrai rendu Electron/Remotion doivent donc être rejoués sur `C:\Dev\SCPT` avant gel définitif.

## Gates Windows attendus

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
pnpm env:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Cible tests : **280/280 PASS dans 49 fichiers**, sauf ajout justifié de tests pendant une correction Windows.

La recette finale Phase 9 doit également produire au moins un vrai rendu intermédiaire depuis une déclinaison SCPT, confirmer la progression, l’annulation ciblée, la reprise et l’absence de processus Chromium/compositor orphelin.

## Frontière Phase 10

La Phase 9 produit uniquement une vidéo intermédiaire. Elle ne réalise pas :

- wrapper `ffmpeg-static` / `ffprobe-static` ;
- mixage narration/musique ;
- normalisation audio ;
- encodage final H.264/AAC contrôlé par SCPT ;
- vérification finale via ffprobe ;
- nommage/export final ;
- ouverture dossier d’export final.

## Conclusion

La Phase 9 est implémentée dans son périmètre canonique. Les risques Windows Remotion/Chromium avaient été levés par le preflight ; l’implémentation principale ajoute maintenant le workflow métier et infrastructure complet de rendu local sans anticiper la Phase 10. Elle peut être appliquée sur la baseline post-preflight puis certifiée sur le vrai environnement Windows Electron.
