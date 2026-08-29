# SCPT — Phase 7 — Rapport d’implémentation

## Statut

Implémentation principale complète de la Phase 7 — Sous-titres, réalisée sur la baseline Phase 6 figée au commit Windows `e69d29c7517f52e7b30f2e91d910753ff4e79937`.

La certification définitive reste à exécuter sur l’environnement Windows canonique (`pnpm`, Node 24, Electron 33.4.11, better-sqlite3 ABI Node/Electron). Aucun résultat Windows n’est revendiqué par ce rapport.

## Contrat canonique couvert

Conformément à `docs/implementation/05-plan-implementation-par-phases.md` et au modèle métier canonique :

- agrégat `PisteSousTitres` ;
- segments ordonnés avec début, fin, texte, position et style facultatif ;
- édition et suppression ;
- timeline ;
- synchronisation depuis la prise de narration finale ;
- export SRT ;
- export WebVTT ;
- incrustation Remotion ;
- invalidation après modification de narration ;
- persistance SQLite ;
- tests des intervalles, chevauchements, exports, caractères spéciaux et resynchronisation.

## Architecture

### Domaine

Ajouts :

- `PisteSousTitresId` ;
- `DeclinaisonId` ;
- `PisteSousTitres` ;
- `PisteSousTitresRepository`.

Le modèle conserve exactement les statuts canoniques :

- `brouillon` ;
- `a_resynchroniser` ;
- `validee` ;
- `obsolete`.

Les invariants principaux sont appliqués dans l’agrégat :

- durée de segment strictement positive ;
- début >= 0 ;
- pas de chevauchement ;
- ordre déterministe ;
- texte non vide ;
- maximum deux lignes ;
- taille maximale de texte bornée ;
- position contrôlée ;
- style visuel borné ;
- impossibilité de valider une piste liée à une version de narration périmée.

`DeclinaisonId` est seulement l’ancre d’identité exigée par le contrat Phase 7. Aucun agrégat, profil, résolution, recomposition ou comportement multi-format de Phase 8 n’est implémenté.

### Synchronisation

La synchronisation Phase 7 est locale, déterministe et sans ASR :

1. la prise de narration finale fournit le texte et la durée réelle ;
2. le texte est segmenté par phrases puis enveloppé avec un objectif de 42 caractères par ligne et deux lignes maximum ;
3. la durée de narration est distribuée proportionnellement au poids textuel ;
4. le premier segment commence à 0 ms ;
5. le dernier se termine exactement à la durée de la prise finale ;
6. les intervalles produits sont contigus et non chevauchants.

Il s’agit d’une synchronisation éditoriale déterministe, pas d’un alignement phonème/mot issu d’un moteur de reconnaissance vocale. L’utilisateur peut ensuite ajuster chaque intervalle dans l’éditeur.

### Invalidation narration → sous-titres

La piste est marquée `a_resynchroniser` lorsque :

- la version du texte de narration change ;
- la prise finale sélectionnée change, même si son texte est identique, car sa durée peut être différente.

Une prise alternative de même texte qui n’est pas retenue comme finale n’invalide pas inutilement les sous-titres.

La validation vérifie aussi directement la version de narration afin qu’un état périmé ne puisse pas être validé par contournement du flux UI.

### Persistance

Tables SQLite ajoutées au fichier `database/project.sqlite` :

- `subtitle_tracks` ;
- `subtitle_segments`.

La sauvegarde piste + segments est transactionnelle. La réouverture reconstruit l’agrégat et réapplique ses invariants. Les connexions sont fermées à `projects:close` et `before-quit`.

Le dossier projet `subtitles/` est créé pour les nouveaux projets ; les projets existants sont compatibles grâce à la création paresseuse des sous-dossiers lors de l’export.

### Export

Formats :

- SRT (`HH:MM:SS,mmm`) ;
- WebVTT (`HH:MM:SS.mmm`, entête `WEBVTT`).

Unicode et accents sont conservés. Les caractères significatifs pour WebVTT sont échappés. L’export n’est autorisé que pour une piste `validee`.

Une copie canonique est conservée dans :

`subtitles/<langue>/master.srt|vtt`

et une copie est écrite vers le chemin choisi par l’utilisateur via la boîte de dialogue native Electron.

Le renderer ne reçoit pas de chemin arbitraire du système de fichiers.

### IPC et sécurité

Canaux Phase 7 :

- `subtitles:get` ;
- `subtitles:synchronize` ;
- `subtitles:update-segment` ;
- `subtitles:add-segment` ;
- `subtitles:delete-segment` ;
- `subtitles:validate` ;
- `subtitles:export`.

Tous les inputs IPC sont validés par Zod côté main. Le preload n’expose que des fonctions typées. Le renderer n’utilise ni `fs`, ni SQLite, ni `child_process`, ni Piper.

### Remotion

`ProjectComposition` reçoit une piste de sous-titres optionnelle. `SubtitleOverlay` :

- sélectionne le cue actif en fonction du frame/fps ;
- respecte les positions haut/centre/bas ;
- applique une zone sûre horizontale ;
- utilise par défaut une police de 42 px, un fort contraste et un fond sombre ;
- fonctionne dans la prévisualisation projet et scène.

En mode scène, les timecodes globaux sont translatés et rognés à la fenêtre temporelle de la scène sans modifier la piste persistée.

### Interface

Le workspace possède maintenant un onglet `Sous-titres` avec :

- état de la piste ;
- nombre de segments ;
- version de narration ;
- synchronisation ;
- validation ;
- export SRT/VTT ;
- activation/désactivation de l’incrustation dans l’aperçu ;
- timeline visuelle ;
- édition texte/début/fin/position ;
- suppression ;
- ajout manuel ;
- messages d’erreur et de resynchronisation.

La Phase 12 reste responsable de la finition premium globale ; aucune refonte hors périmètre n’a été anticipée.

## Dépendances

Aucune nouvelle dépendance npm n’a été ajoutée pour la Phase 7. L’implémentation réutilise React, Electron, Remotion, SQLite/better-sqlite3, Zod et les composants déjà présents dans la baseline Phase 6.

## Tests ajoutés

Suites ajoutées :

- domaine `PisteSousTitres` ;
- synchroniseur et formatteurs SRT/VTT ;
- use cases ;
- repository SQLite et cycle close/reopen ;
- filesystem/export ;
- utilitaires d’incrustation Remotion.

Les cas couvrent notamment :

- intervalles valides ;
- chevauchements refusés ;
- deux lignes maximum ;
- édition/suppression/réordonnancement ;
- piste validée retournant en brouillon après édition ;
- version de narration périmée ;
- resynchronisation ;
- synchronisation déterministe jusqu’à la durée finale ;
- SRT ;
- VTT ;
- accents et caractères spéciaux ;
- persistence ;
- absence de narration finale ;
- export interdit avant validation ;
- translation/rognage des cues pour l’aperçu scène.

Le comptage statique après implémentation recense **34 fichiers de test** et **200 appels `it(...)` / `test(...)`**. Ce comptage ne remplace pas l’exécution Vitest : le total exécutable exact doit être confirmé par `pnpm test` sur Windows.

## Validation effectuée dans l’environnement d’implémentation

L’environnement d’implémentation n’est pas l’environnement Windows canonique : Node 22 est disponible ici et le ZIP fourni exclut `node_modules`.

Contrôles possibles effectués :

- parsing TypeScript/TSX de toutes les sources ;
- résolution de tous les imports relatifs ;
- recherche d’imports Node interdits dans le renderer ;
- revue des frontières renderer → preload → IPC → application → infrastructure ;
- revue du diff limité à la Phase 7 ;
- **143 fichiers TypeScript/TSX applicatifs parsés, 0 erreur de syntaxe** ;
- **0 import relatif manquant** ;
- **0 import Node interdit détecté dans `src/renderer`** ;
- **34 fichiers de test / 200 cas statiquement recensés**.

Les gates suivants restent obligatoires sur `C:\Dev\SCPT` :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
pnpm env:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

## Hors périmètre respecté

Aucune fonctionnalité de Phase 8 ou ultérieure n’est implémentée :

- pas d’agrégat multi-format ;
- pas de 9:16 / 1:1 ;
- pas de rendu `@remotion/renderer` ;
- pas d’export vidéo FFmpeg ;
- pas de packaging supplémentaire.
