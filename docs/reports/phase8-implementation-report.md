# SCPT — Rapport d’implémentation Phase 8

## Statut

**Implémentation principale terminée — certification Windows requise avant gel définitif.**

Baseline de départ : source Phase 7 validée sur Windows avec 34/34 fichiers de tests et 200/200 tests PASS, typecheck/lint/build/Electron réel PASS.

La Phase 8 reste strictement limitée aux **déclinaisons multi-format**. Aucune fonctionnalité de rendu Phase 9 (`@remotion/renderer`, `@remotion/bundler`) ni d’export FFmpeg Phase 10 n’a été ajoutée.

## Contrat Phase 8 couvert

Le plan canonique exige : agrégat déclinaison, résolution, profil, zones de sécurité, recomposition, aperçu par format et statut obsolète, avec tests de format, résolution, surcharge, version source et preuve que le vertical n’est pas un simple recadrage.

L’implémentation couvre :

- formats 16:9, 9:16 et 1:1 ;
- résolutions canoniques 1920×1080, 1080×1920 et 1080×1080 ;
- profil `MVP_PREMIUM` sans anticiper l’encodage Phase 10 ;
- agrégat `DeclinaisonAudiovisuelle` et cycle de statut ;
- version métier propre à chaque déclinaison ;
- version sémantique du projet maître et détection d’obsolescence ;
- héritage du projet maître avec surcharges par scène ;
- zones sûres par format ;
- recomposition déterministe des scènes ;
- prévisualisation Remotion par format ;
- UI de création/sélection/validation des déclinaisons ;
- persistance SQLite ;
- IPC/preload typés ;
- tests de domaine, application, infrastructure, recomposition et preview.

## Décisions d’architecture

### Projet maître distinct des déclinaisons

Les scènes, médias, narration et sous-titres restent la source du projet maître. Une déclinaison référence cette source par `projetId` et par une `versionProjetSource`. Elle ne modifie jamais directement les scènes maîtres.

### Pas de simple crop vertical

Il n’existe aucun mode « crop 16:9 → 9:16 ». Le moteur `declination-layout.ts` recompose les layouts. En particulier, un `split-left` ou `split-right` horizontal est transformé en flux centré pleine largeur pour les formats vertical/carré, sauf surcharge explicite.

### Surcharges contrôlées

Une déclinaison peut surcharger, scène par scène :

- disposition (`centered`, `top`, `split-left`, `split-right`) ;
- couleur de fond.

Les surcharges sont persistées séparément et ne mutent pas la scène source.

### Obsolescence déterministe

`project-source-snapshot.ts` calcule une empreinte SHA-256 sur les champs sémantiques de :

- scènes ;
- ressources média ;
- narration réellement renseignée ;
- sous-titres réellement renseignés.

Les timestamps opérationnels sont exclus. Une sauvegarde sans changement sémantique ne rend donc pas artificiellement une déclinaison obsolète.

Une modification réelle du projet maître incrémente la version source et les déclinaisons basées sur une ancienne version deviennent `obsolete`.

### Phase 7 préservée

Les sous-titres restent attachés à leur `DeclinaisonId`. La première déclinaison 16:9 peut réutiliser proprement l’identifiant d’ancrage créé par la Phase 7 quand celui-ci est libre, sans réanimer une ancienne ligne obsolète.

### Sécurité

Le renderer ne reçoit aucun accès Node, SQLite ou filesystem. Le flux reste :

`React → preload → IPC → use cases → repositories/adapters`.

Aucune modification de `contextIsolation`, `sandbox`, `webSecurity` ou CSP n’est nécessaire.

## UI / Preview

Le workspace expose un panneau **Déclinaisons visuelles** :

- carte 16:9 ;
- carte 9:16 ;
- carte 1:1 ;
- résolution ;
- statut ;
- version propre et version source ;
- création/nouvelle version ;
- sélection pour aperçu ;
- validation ;
- passage à « prête pour rendu » sans effectuer de rendu ;
- surcharge de la scène sélectionnée ;
- avertissement quand la source contient des changements non sauvegardés.

Le `PreviewPanel` adapte dynamiquement largeur/hauteur Remotion, zones sûres, typographie, tailles de formule/code, images, diagrammes et sous-titres au format choisi.

## Frontière Phase 9

La Phase 8 prépare uniquement l’état `pret_pour_rendu`. Elle ne :

- bundle pas une composition pour rendu headless ;
- ne lance pas Chromium de rendu ;
- ne crée pas de file de rendu ;
- ne produit pas de vidéo intermédiaire ;
- n’utilise ni `@remotion/renderer` ni `@remotion/bundler`.

## Contrôles effectués dans l’environnement d’implémentation

Contrôles statiques finaux :

- 173 fichiers TypeScript/TSX analysés ;
- 0 erreur de parsing TypeScript/TSX ;
- 0 import relatif manquant ;
- 0 import Node interdit détecté dans `src/renderer` ;
- 41 fichiers de tests présents ;
- 241 cas `it()` / `test()` recensés ;
- `package.json` inchangé par rapport à la Phase 7 ;
- aucune dépendance Phase 9/10 introduite.

L’environnement d’implémentation ne contient pas le `node_modules` Windows du projet et utilise Node 22 au lieu du couple cible Node 24 / Electron 33. Par conséquent, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` et le vrai Electron Windows doivent être exécutés sur `C:\Dev\SCPT` avant gel définitif.

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

Cible tests : **241/241 PASS dans 41 fichiers**, sauf ajout justifié de tests pendant une correction Windows.

## Conclusion

La Phase 8 est implémentée dans son périmètre canonique et reste isolée de la Phase 9. Elle peut maintenant être appliquée sur la baseline Phase 7 validée puis certifiée dans le vrai environnement Windows Electron.
