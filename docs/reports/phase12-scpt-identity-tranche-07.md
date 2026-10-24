# SCPT — Phase 12 — Identité Windows — Tranche 07

## Décision

L’icône proposée le 31/08/2026 a été explicitement validée par l’utilisateur et devient la base visuelle officielle de SCPT pour la Phase 12.

## Intégration réalisée

- source de marque conservée dans `resources/branding/scpt-icon.png` ;
- PNG Windows/Electron 512 px dans `build/icon.png` ;
- ICO Windows multi-résolutions dans `build/icon.ico` (16, 24, 32, 48, 64, 128 et 256 px) ;
- `electron-builder` utilise explicitement `build/icon.ico` pour l’exécutable Windows ;
- NSIS utilise la même identité pour l’installateur, le désinstallateur et son en-tête ;
- la fenêtre Electron reçoit une icône explicite ;
- le wordmark de l’accueil utilise désormais l’icône officielle au lieu du pictogramme provisoire.

## Invariants préservés

Aucun contrat IPC, modèle de domaine, migration SQLite, pipeline Remotion, FFmpeg, Piper ou stratégie ABI `better-sqlite3` n’a été modifié.

## Version

Le numéro de version reste volontairement inchangé (`0.0.0`) dans cette tranche. L’identité visuelle est désormais verrouillée, mais le numéro de la Release Candidate doit être arrêté séparément avant le packaging final.

## Certification

Cette tranche prépare les artefacts de marque. Elle ne constitue pas la certification Windows finale : le rendu de l’icône dans le vrai EXE/Setup, la barre des tâches, les raccourcis et l’installation/désinstallation doivent encore être vérifiés sur Windows.
