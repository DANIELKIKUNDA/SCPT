# SCPT — Phase 12 — Version RC.1 — Tranche 08

Date : 2026-08-31

## Décision

La première Release Candidate de SCPT est officiellement numérotée **1.0.0-rc.1**.

Cette décision intervient après validation de l’identité visuelle SCPT et avant la certification Windows finale de la Phase 12.

## Modification

- `package.json` : `version` passe de `0.0.0` à `1.0.0-rc.1`.
- Aucun numéro de format projet ou de schéma SQLite n’est modifié.
- Aucun contrat IPC, moteur Remotion, FFmpeg, Piper ou comportement métier n’est modifié.
- Les anciennes chaînes `0.0.0` présentes dans certains tests IPC sont des fixtures/mocks explicites et ne constituent pas la version produit ; elles sont conservées afin de ne pas transformer inutilement la portée de ces tests.

## Effets attendus

Electron `app.getVersion()` doit désormais exposer `1.0.0-rc.1` dans un build issu de ce package. Les métadonnées de fiabilité et de sauvegarde qui utilisent `app.getVersion()` enregistreront donc cette version pour les nouveaux artefacts créés par cette RC.

Le Setup Windows généré par electron-builder doit être nommé selon cette version, sous réserve de la configuration de nommage déjà certifiée dans la préparation Windows.

## Statut

Cette tranche verrouille le numéro de version. Elle ne constitue pas à elle seule la certification finale de la Phase 12 : typecheck, lint, tests, E2E Electron, build, packaging et vérification des artefacts Windows restent les gates de clôture.
