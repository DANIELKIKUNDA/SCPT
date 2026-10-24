# SCPT — Constats & correctifs packaging Windows (`pnpm package:win`)

## Contexte

Ce document consigne les blocages et correctifs découverts pendant la validation de
`pnpm package:win` (electron-vite build + electron-builder --win) sur `C:\Dev\SCPT`.

## 1. Blocage electron-builder + pnpm (symlinks) — RÉSOLU

### Symptôme

`electron-builder --win` restait bloqué en phase de collecte `node_modules`
(« unresolved deps » + `round=1`/`round=2`, aucun `app.asar` produit après 15 min).
Cause : le layout pnpm par défaut (`node-linker=isolated`) expose `node_modules` sous
forme de symlinks vers `.pnpm`, que la collecte de dépendances d'electron-builder
parcourt de façon pathologique (notamment avec les nombreux paquets optionnels de
`sharp`/`@img`).

### Correctif

Fichier `.npmrc` ajouté :

```ini
node-linker=hoisted
```

Après `pnpm install`, `node_modules` est aplati (répertoires réels, plus de symlinks
vers `.pnpm`). La collecte d'electron-builder aboutit alors normalement
(`app.asar` produit, application `win-unpacked` générée).

> Effet secondaire : `node-linker=hoisted` fait télécharger les binaires optionnels
> multi-plateformes de `sharp`/`@img`/`esbuild`/`@remotion` (réseau plus sollicité,
> package plus volumineux — voir §4).

## 2. Binaire better-sqlite3 ABI incorrect dans le package — RÉSOLU

### Symptôme

`postinstall.mjs` laisse actif le binaire **Node 24 (ABI 137)**. Or Electron 33
utilise **ABI 130**. Le script `package:win` n'échangeait pas le binaire avant
empaquetage, donc le package embarquait le binaire Node 24
(`better_sqlite3.node` = 1 885 184 octets au lieu du `.electron33` = 1 714 688 octets).

### Correctif

Ajout de hooks d'échange dans `package.json` (même mécanisme que `predev`/`postdev`) :

```jsonc
"prepackage:win": "node scripts/swap-sqlite-binary.mjs electron",
"package:win": "electron-vite build && electron-builder --win",
"postpackage:win": "node scripts/swap-sqlite-binary.mjs node"
```

Vérifié : l'échange produit bien `better_sqlite3.node` = 1 714 688 octets (electron)
puis restaure 1 885 184 octets (node).

## 3. Installateur NSIS — BLOQUÉ (privilège symlink Windows)

### Symptôme

La phase NSIS télécharge `winCodeSign-2.6.0.7z`, mais son extraction échoue en
boucle :

```
ERROR: Cannot create symbolic link : Le client ne dispose pas d'un privilège nécessaire. :
  ...\winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

L'archive contient des liens symboliques (`.dylib` darwin). `7za.exe x -snld` exige
alors le privilège `SeCreateSymbolicLinkPrivilege`, absent car l'environnement
n'est **pas administrateur** et le **Mode Développeur est désactivé**
(test : `New-Item -ItemType SymbolicLink` → « Cette opération nécessite un privilège
d'administrateur »).

### Déblocage requis (environnement, pas du code)

- exécuter `pnpm package:win` dans un terminal **Administrateur**, ou
- activer le **Mode Développeur Windows**
  (`reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /v AllowDevelopmentWithoutDevLicense /d 1 /f`
  puis nouvelle session/redémarrage).

### État de fait

`dist\win-unpacked\SCPT.exe` est produit et se lance correctement (application
portable complète). Seul le fichier `Setup *.exe` NSIS n'est pas généré à cause de
ce privilège.

## 4. Taille du package (constat)

`app.asar.unpacked` ≈ 512 Mo, principalement à cause de :

- `ffmpeg-static` / `ffprobe-static` (~140 Mo d'exécutables) ;
- `@img/**/*` : avec `node-linker=hoisted`, tous les binaires `@img` multi-plateformes
  sont téléchargés puis déballés par le motif large `asarUnpack: ["node_modules/@img/**/*"]`.

Piste d'optimisation (non appliquée) : restreindre `asarUnpack` à la plateforme
courante (`node_modules/@img/sharp-win32-x64/**/*`) et/ou ajouter un
`pnpm.supportedArchitectures` pour ne pas télécharger les plateformes inutiles.

## 5. Gates validés après correctifs

Sur `C:\Dev\SCPT` (node-linker=hoisted + hooks de swap en place) :

- `pnpm typecheck` : **PASS** ;
- `pnpm test` : **68/68 fichiers, 379/379 tests PASS** ;
- `electron-vite build` : PASS (déjà produit, contenu `out/` complet dans l'asar) ;
- `dist\win-unpacked\SCPT.exe` : **lancement réel OK** (arbre de processus Electron
  normal : main + GPU + renderer + utility, pas de crash au démarrage).
