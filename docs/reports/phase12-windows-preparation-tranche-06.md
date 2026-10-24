# SCPT — Phase 12 — Préparation Windows — Tranche 06

## Objet

Cette tranche prépare la distribution Windows finale sans modifier le domaine métier, SQLite, Remotion, FFmpeg, Piper ni les contrats IPC certifiés en Phase 11.

## Changements réalisés

### Identité de la fenêtre Windows

La fenêtre principale possède maintenant un titre explicite `SCPT — Studio de Création Pédagogique et Technique`, une taille initiale 1280×820, une taille minimale 1024×700 et l'AppUserModelID Windows stable `com.scpt.app`.

### Cible Windows/NSIS explicite

La configuration electron-builder verrouille explicitement la cible `nsis` en `x64`. Le comportement reste conforme à la doctrine : installation par utilisateur, choix du dossier d'installation, conservation des données lors de la désinstallation.

Les raccourcis Bureau et menu Démarrer sont explicitement configurés. L'installateur ne lance pas automatiquement SCPT à la fin : le premier lancement doit rester une étape contrôlée de la recette finale.

### Vérification reproductible

Ajout de :

```text
pnpm verify:win-package
```

Cette commande contrôle statiquement les invariants Windows. Après packaging, la variante suivante vérifie également la présence de l'EXE packagé, de l'installateur et de son blockmap :

```text
node scripts/verify-windows-package.mjs --artifacts
```

## Décisions conservatoires

### Version applicative

`package.json` reste volontairement à `0.0.0`. Aucun document canonique audité ne fixe encore le numéro public de la Phase 12. Inventer une version modifierait aussi les métadonnées de compatibilité et de sauvegarde du projet. La version finale doit être décidée avant le dernier packaging.

### Icône

Aucun asset d'identité SCPT (`.ico`, `.png`, `.svg`) n'existe dans le ZIP audité. Aucune icône de marque n'est inventée dans cette tranche. Le packaging continuera donc à utiliser l'icône Electron par défaut tant qu'un logo/icône SCPT approuvé n'est pas fourni ou créé explicitement.

### Signature

Aucun certificat de signature n'est présent. La signature reste facultative pour le MVP interne selon la documentation, mais recommandée avant diffusion publique. Aucun certificat ni secret n'est fabriqué.

### electron-builder

La version 25.1.8 reste inchangée pendant la certification.

### better-sqlite3

`npmRebuild=false` et les hooks de swap ABI sont conservés. `@electron/rebuild` n'est pas supprimé malgré l'avertissement electron-builder car `scripts/postinstall.mjs` l'utilise réellement pour produire le binaire Electron 33 de `better-sqlite3`.

## Gates restant à exécuter sur Windows

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e:electron`
5. `pnpm build`
6. `pnpm verify:win-package`
7. `pnpm package:win`
8. `node scripts/verify-windows-package.mjs --artifacts`
9. installation du Setup final, premier lancement, fonctions critiques, fermeture/réouverture et désinstallation.

La Phase 12 n'est pas déclarée figée par cette tranche.
