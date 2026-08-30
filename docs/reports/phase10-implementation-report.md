# SCPT — Rapport d’implémentation Phase 10

## Statut

**Implémentation principale terminée — certification Windows requise avant gel définitif.**

Baseline de départ : Phase 9 définitivement figée sur Windows avec 49/49 fichiers de tests, 280/280 tests PASS, rendu Remotion réel 16:9 et 9:16, progression, annulation, retry et reprise validés. Le preflight Phase 10 a ensuite validé sur le vrai Windows `ffmpeg-static@5.3.0`, `ffprobe-static@3.1.0`, FFmpeg 6.1.1, FFprobe 4.0.2, H.264/libx264, AAC 48 kHz, `yuv420p`, `loudnorm`, ffprobe JSON, annulation, timeout, chemins Windows difficiles, absence de processus orphelins et compatibilité main Electron 33.

La Phase 10 reste strictement limitée à la **finalisation et vérification du MP4 final**. Aucune fonctionnalité de Phase 11 n’est implémentée.

## Contrat Phase 10 couvert

Le plan canonique exige : wrapper FFmpeg, wrapper FFprobe, mixage, H.264, AAC, MP4, normalisation audio, nom de fichier, checksum, vérification et ouverture dossier, avec tests FFmpeg absent, disque plein, fichier corrompu, audio absent, durée incorrecte et export immuable.

L’implémentation couvre :

- agrégat métier `ExportFinalAudiovisuel` distinct du rendu intermédiaire Phase 9 ;
- machine d’état dédiée à la finalisation ;
- persistance SQLite `final_exports` ;
- use cases demande, liste et relance ;
- source obligatoire : rendu Phase 9 terminé, non obsolète et checksum inchangé ;
- narration finale validée et checksum inchangé ;
- gate de droits médias (`originale`, `autorisee`, `libre`) avant export ;
- action UI permettant de renseigner les droits d’un média ;
- résolution locale et sûre de `ffmpeg.exe` / `ffprobe.exe`, y compris en contexte `app.asar.unpacked` ;
- analyse `loudnorm` puis encodage final deux passes logiques ;
- H.264/libx264, `yuv420p`, 30 fps ;
- AAC 192 kbit/s, 48 kHz ;
- normalisation audio cible -16 LUFS / -1 dBTP / LRA 11 ;
- padding/trim audio à la durée du rendu vidéo ;
- exécution FFmpeg/FFprobe via `execa` avec `shell:false`, timeout et `AbortSignal` ;
- progression FFmpeg réelle issue de `-progress pipe:1` ;
- inspection FFprobe JSON ;
- validation objective conteneur, codecs, résolution, fps, sample rate et durée ;
- checksum SHA-256 de la sortie finale ;
- contrôle d’espace disque avant encodage ;
- fichier temporaire isolé sous `temp/exporting/` ;
- promotion atomique vers `renders/final/` uniquement après vérification ;
- refus d’écrasement d’un MP4 final existant ;
- nettoyage après succès, échec, annulation et timeout ;
- suppression de la sortie finale orpheline si la persistance du statut `termine` échoue après commit fichier ;
- queue locale `p-queue` à concurrence 1 ;
- annulation ciblée et reprise après fermeture/réouverture ;
- logs JSONL append-only ;
- ouverture du fichier et révélation dans le dossier via l’API Electron `shell`, sans commande shell arbitraire ;
- IPC/preload typés ;
- panneau **Export final MP4** intégré au workspace ;
- configuration `asarUnpack` pour les binaires `ffmpeg-static` et `ffprobe-static` lors du packaging.

## Machine d’état

`ExportFinalAudiovisuel` utilise :

`demande → en_attente → en_preparation → en_encodage → en_verification → termine`

avec terminaux alternatifs `echoue` et `annule`.

Une sortie `termine` exige :

- progression 100 % ;
- chemin relatif projet ;
- nom `.mp4` ;
- checksum SHA-256 ;
- taille > 0 ;
- durée > 0 ;
- résolution valide ;
- H.264 ;
- `yuv420p` ;
- AAC ;
- 48 kHz ;
- fps proche de 30.

## Entrées et intégrité des sources

Avant encodage, `FinalExportInputBuilder` vérifie :

- existence et appartenance du rendu Phase 9 au projet ;
- statut `termine` et présence du fichier intermédiaire ;
- checksum du rendu identique à celui mémorisé dans la demande d’export final ;
- version actuelle du projet maître identique à celle du rendu ;
- déclinaison existante et non obsolète ;
- narration validée et prise finale présente ;
- identité et checksum de la prise finale inchangés ;
- présence physique des fichiers vidéo/audio ;
- recalcul des deux checksums avant traitement ;
- présence des streams vidéo/audio ;
- résolution du rendu conforme à la déclinaison ;
- cohérence de durée de la narration avec la vidéo.

Le use case de demande bloque aussi l’export si un média du projet est manquant/corrompu ou si ses droits sont `inconnue` / `interdite`.

## FFmpeg

`FFmpegEncodingAdapter` encapsule FFmpeg derrière `EncodageVideoPort`. Le domaine n’importe jamais FFmpeg.

Le pipeline :

1. analyse `loudnorm` de la narration ;
2. encodage vidéo H.264/libx264 ;
3. pixel format `yuv420p` ;
4. cadence 30 fps ;
5. normalisation audio avec mesures réinjectées ;
6. resampling 48 kHz ;
7. padding/trim audio à la durée vidéo ;
8. AAC 192 kbit/s ;
9. MP4 `+faststart` ;
10. progression réelle sur stdout ;
11. annulation / timeout ciblés ;
12. suppression du fichier incomplet en cas d’échec.

Le preflight avait démontré que `ffmpeg-static@5.3.0` peut signaler un refus d’écrasement sur stderr tout en retournant exit code 0. L’adapter ne se fie donc pas uniquement au code de sortie et détecte explicitement les messages `already exists` / `not overwriting`.

## FFprobe et validation objective

`FFprobeInspectionAdapter` utilise `ffprobe-static` en JSON (`-show_format -show_streams`). `verifyFinalMedia()` refuse une sortie qui ne respecte pas :

- conteneur MP4 ;
- stream vidéo H.264 ;
- `yuv420p` ;
- résolution attendue ;
- 30 fps avec faible tolérance ;
- stream audio AAC ;
- 48 kHz ;
- durée globale attendue ;
- cohérence durée audio/vidéo lorsque la durée stream audio est fournie par ffprobe.

La sortie n’est promue vers `renders/final/` qu’après cette vérification.

## Immutabilité, disque et temporaires

Chaque tentative utilise :

`temp/exporting/<exportId>/attempt-<n>/finalizing.mp4`

La sortie finale est placée sous :

`renders/final/<titre>_<format>_<suffixe>.mp4`

Le nom est nettoyé pour Windows et limité en longueur. Un fichier final existant n’est jamais écrasé silencieusement.

Avant encodage, l’espace libre est comparé à une estimation conservatrice calculée depuis la taille des deux entrées avec marge fixe. Le vrai scénario disque plein n’est pas provoqué de manière destructive ; le code produit l’erreur contrôlée `FINAL_EXPORT_DISK_SPACE_INSUFFICIENT` avant lancement lorsque l’espace disponible est insuffisant.

## Reprise, annulation et queue

`FinalExportCoordinator` possède une queue partagée à `concurrency: 1`.

- une annulation utilisateur persiste `annule`, puis abort uniquement le processus associé ;
- une fermeture contrôlée interrompt le traitement et remet un export actif en `en_attente` pour reprise ;
- une relance utilisateur après `echoue` / `annule` incrémente la tentative et rafraîchit les checksums sources ;
- à la réouverture, les statuts actifs sont récupérés et replanifiés ;
- les temporaires sont nettoyés dans `finally` ;
- les logs restent append-only.

## Sécurité Electron

Le flux reste :

`React → preload → IPC → use case/coordinator → adapters/repositories/filesystem`.

Le renderer n’importe ni `fs`, ni SQLite, ni `child_process`, ni `execa`, ni FFmpeg/FFprobe. Les entrées IPC sont validées côté main. L’ouverture du fichier/dossier passe par `shell.openPath()` et `shell.showItemInFolder()` sur un chemin résolu à l’intérieur du projet.

Aucune modification n’est apportée aux protections Electron (`contextIsolation`, `nodeIntegration`, `sandbox`, `webSecurity`, CSP).

## Packaging des binaires

Le preflight avait établi que les binaires sont locaux dans `node_modules` et qu’aucun téléchargement n’est nécessaire au runtime. `package.json` ajoute :

```json
"build": {
  "asarUnpack": [
    "node_modules/ffmpeg-static/**/*",
    "node_modules/ffprobe-static/**/*"
  ]
}
```

`ffmpeg-binary-resolver.ts` transforme le chemin `app.asar` vers `app.asar.unpacked` lorsque nécessaire.

La question de redistribution/licence GPL du build FFmpeg reste documentée par le preflight et devra être traitée dans la livraison Phase 14 ; elle n’est pas masquée par cette implémentation.

## UI

Le workspace expose un panneau **Export final MP4** avec :

- sélection d’un rendu intermédiaire terminé ;
- lancement du MP4 final ;
- progression ;
- statut et tentative ;
- annulation ;
- relance ;
- métadonnées techniques de la sortie ;
- checksum ;
- lecture du fichier ;
- révélation dans le dossier ;
- diagnostic JSONL.

La médiathèque permet également de renseigner les droits requis pour l’export final.

## Tests Phase 10

La working copy finale contient **59 fichiers de tests et 342 cas `it()` / `test()` recensés statiquement**. La baseline Phase 9 contenait 49 fichiers / 280 tests.

Les nouveaux tests couvrent notamment :

- invariants et transitions `ExportFinalAudiovisuel` ;
- demande, double demande et retry ;
- droits médias ;
- helpers FFmpeg et détection non-écrasement ;
- parsing `loudnorm` ;
- parsing FFprobe JSON ;
- filesystem export final ;
- contrôle espace disque ;
- protection contre les chemins hors projet ;
- immutabilité ;
- checksum ;
- input builder et cohérence des sources ;
- vérification H.264/AAC/yuv420p/fps/48 kHz/durée ;
- persistence SQLite `final_exports` ;
- coordinator succès, progression, annulation, échec, reprise et concurrence ;
- UI Export final ;
- non-régression des tests existants.

## Contrôles effectués dans l’environnement d’implémentation

Contrôles structurels finaux :

- 219 fichiers TypeScript/TSX analysés ;
- 0 erreur de parsing TypeScript/TSX ;
- 0 import relatif TypeScript/TSX manquant ;
- 0 import Node/SQLite/Execa/FFmpeg/FFprobe interdit détecté dans `src/renderer` ;
- 59 fichiers de tests présents ;
- 342 cas `it()` / `test()` recensés ;
- aucune suppression de fichier de la baseline ;
- aucune fonctionnalité Phase 11 ajoutée.

L’environnement d’implémentation n’est pas le Windows cible et ne contient pas son `node_modules`. Les gates complètes doivent donc être rejouées sur `C:\Dev\SCPT` avant gel définitif.

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

Cible : **59/59 fichiers de tests et 342/342 tests PASS**, sauf correction justifiée modifiant ce total.

La recette fonctionnelle finale doit également produire au moins un vrai MP4 final depuis le workflow SCPT et confirmer : H.264/AAC, 48 kHz, checksum, progression, annulation, reprise, immutabilité, ouverture dossier et absence de processus FFmpeg/FFprobe orphelins.

## Frontière Phase 11

Aucune fonctionnalité Phase 11 n’est implémentée. En particulier, cette phase n’ajoute pas le centre général d’audit/anomalies, la stratégie complète de backup/restauration, le nettoyage global des temporaires, le tableau global des tâches, ni la politique générale d’obsolescence/versionnement de robustesse prévue pour Phase 11.

## Conclusion

La Phase 10 est implémentée dans son périmètre canonique : elle transforme un rendu intermédiaire Phase 9 et une narration finale en MP4 H.264/AAC normalisé, vérifié par FFprobe, checksumé, immuable et exploitable localement. Le preflight Windows avait levé les risques binaires ; cette implémentation ajoute maintenant le workflow métier, persistence, orchestration, sécurité et UI nécessaires, sans anticiper la Phase 11.
