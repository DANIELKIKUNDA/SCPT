# SCPT — Phase 12 RC.1 — rapport de certification Windows

Date d’exécution : 2026-10-24
Version candidate : `1.0.0-rc.1`
Plateforme : Windows 11 x64 (`10.0.22631`)
Runtime : Node.js `24.19.0`, Electron `33.4.11`, pnpm `9.15.9`

## Verdict

**Toutes les portes techniques exécutables de la RC.1 sont validées sur Windows réel.**

La Phase 12 peut être déclarée certifiée techniquement lorsque les changements de la phase sont regroupés dans un commit de certification et que le checkpoint correspondant est créé. La distribution publique demeure non signée : aucun certificat de signature de code n’était configuré pendant la génération.

## Résultats reproductibles

| Contrôle | Résultat |
|---|---:|
| `pnpm env:check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | **379/379 PASS — 68/68 fichiers** |
| `pnpm build` | PASS |
| `pnpm test:e2e:electron` sur le build de développement | **12/12 PASS** |
| `pnpm verify:win-package` | **17/17 PASS** |
| `pnpm package:win` | PASS |
| `node scripts/verify-windows-package.mjs --artifacts` | **21/21 PASS** |
| E2E sur `dist/win-unpacked/SCPT.exe` | **12/12 PASS** |
| Installation silencieuse isolée du Setup | PASS — code `0` |
| E2E sur la copie installée | **12/12 PASS** |
| Désinstallation silencieuse | PASS — code `0` |
| Nettoyage du dossier d’installation temporaire | PASS |

## Artefacts produits

- Installateur : `dist/SCPT Setup 1.0.0-rc.1.exe`
- Taille : `328379346` octets
- SHA-256 : `403031F5CEB65F06B943D1CD15CB3B31F6DF12A3F3FFC7C13D25C90BBE0EB2F2`
- Blockmap : `dist/SCPT Setup 1.0.0-rc.1.exe.blockmap` (`338734` octets)
- Application emballée : `dist/win-unpacked/SCPT.exe`
- Métadonnées contrôlées : produit `SCPT`, société `SCPT`, version fichier `1.0.0-rc.1`, version produit `1.0.0.0`.

## Portée du parcours E2E

Les trois exécutions du parcours réel ont contrôlé : lancement Electron, titre SCPT, isolation du renderer, preload typé, affichage 1366×768 sans débordement, création et ouverture de projet, création et sauvegarde de scène, navigation clavier, ouverture des sept outils de production, fermeture/réouverture avec persistance, raccourci `Ctrl+S`, absence d’erreur fatale et fermeture propre.

Chaque exécution utilisait un `userData` temporaire ; aucun projet utilisateur n’a été modifié.

## Stabilisations nécessaires à la certification

- création du fichier cible avant acquisition du verrou `proper-lockfile` sous Windows ;
- correction de l’import `Clapperboard` qui provoquait un écran vide au premier lancement ;
- alignement des sélecteurs E2E sur l’interface RC.1 ;
- possibilité de piloter le build de développement, l’application emballée et la copie installée avec le même scénario ;
- Vitest configuré avec un worker thread unique afin d’éviter l’assertion native de nettoyage de `better-sqlite3` sous Node 24/Windows, sans retirer aucun test.

## Observations et réserve de distribution

- L’avertissement Vite relatif à son API CJS est non bloquant.
- L’avertissement Node sur `fs.rmdir(..., { recursive: true })` est une dépréciation non bloquante.
- L’environnement contrôlé de l’assistant injecte `ELECTRON_RUN_AS_NODE=1` uniquement au niveau du processus. Les niveaux utilisateur et machine sont vides ; `env:check` passe après neutralisation locale, comme dans une session utilisateur normale.
- Aucun certificat de signature de code n’est configuré. L’installateur fonctionne et est vérifié localement, mais une diffusion publique devrait signer les exécutables afin de réduire les avertissements SmartScreen.

## État

**RC.1 validée techniquement sur Windows. Phase 12 non encore figée dans Git au moment de ce rapport.**
