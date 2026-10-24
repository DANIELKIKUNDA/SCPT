# SCPT — Phase 12 — E2E Electron réel

## Objet

Cette tranche remplace le spike Playwright de préflight par une suite E2E reproductible qui pilote **l'application Electron SCPT réelle**.

## Commande canonique

```powershell
pnpm test:e2e:electron
```

Le lanceur :

1. bascule `better-sqlite3` vers le binaire Electron 33 / ABI 130 ;
2. construit l'application avec `electron-vite` ;
3. lance la suite Playwright Electron ;
4. restaure systématiquement le binaire Node, y compris si un test échoue.

## Isolation

Chaque exécution utilise un `--user-data-dir` temporaire. La certification ne doit donc jamais écrire dans le catalogue, les préférences, les projets, les sauvegardes ou les journaux SCPT de l'utilisateur.

## Portée des 12 gates

- lancement de l'Electron réel et titre SCPT ;
- frontière de sécurité `contextIsolation` / absence de Node dans le renderer / preload exposé ;
- viewport 1366×768 sans débordement horizontal ;
- création et ouverture d'un vrai projet via l'UI ;
- création d'une vraie scène ;
- édition et sauvegarde persistante ;
- navigation clavier des onglets de production ;
- ouverture des sept espaces Narration, Sous-titres, Médias, Formats, Rendus, Export final et Fiabilité ;
- fermeture puis réouverture du projet avec vérification de persistance ;
- raccourci `Ctrl+S` ;
- absence d'erreur fatale renderer/page/main ;
- fermeture propre d'Electron.

## Exécution Windows de certification

Le 2026-10-24, le parcours a été exécuté avec succès sur Windows 11 x64, Node.js 24.19.0 et Electron 33.4.11 :

- build de développement : **12/12 PASS** ;
- application emballée `dist/win-unpacked/SCPT.exe` : **12/12 PASS** ;
- copie issue d'une installation réelle du Setup : **12/12 PASS**.

Les trois passages ont restauré `better-sqlite3` vers l'ABI Node après exécution et n'ont touché aucun projet utilisateur. Le détail, les artefacts et leur empreinte sont consignés dans `phase12-rc1-certification-attempt.md`.
