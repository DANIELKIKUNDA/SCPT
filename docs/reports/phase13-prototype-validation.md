# SCPT — Phase 13 — Prototype de validation réel

## Statut

**Verdict au 1er novembre 2026 : `PHASE 13 CERTIFIABLE`**

Le parcours réel est démontré de bout en bout. Le 1er novembre 2026, le propriétaire du projet a confirmé après écoute l'intelligibilité, la prononciation, l'absence de coupure et le rythme de la narration Piper.

## Baseline et environnement

- Branche : `main`
- Baseline Phase 12 figée : `b33e6591e1a6b5b084b52c2f4f02453fdc355291`
- Version : `1.0.0-rc.1`
- Plateforme : Windows, exécution locale/offline
- Moteurs réels : Electron 33, SQLite, Piper `fr_FR-siwis-medium`, Remotion 4.0.0, FFmpeg/FFprobe
- Projet persistant : `01M5QABC9NV2MGVCDS5RYB1VD5`
- Emplacement des preuves locales : `dist/phase13/`

La Phase 12 n'a pas été rouverte ni requalifiée. Toutes les modifications décrites ici appartiennent à la Phase 13.

## Prototype

Projet : **SCPT — Prototype Phase 13 — Les logarithmes**

Le projet contient 10 scènes :

1. introduction ;
2. rappel sur les puissances ;
3. définition du logarithme ;
4. conditions d'existence ;
5. produit et quotient ;
6. puissance ;
7. exemple numérique ;
8. courbe de `log₂(x)` ;
9. application guidée ;
10. synthèse.

Les formules contrôlées sont mathématiquement correctes et rendues par KaTeX, notamment `log_a(x)=y ⇔ a^y=x`, les conditions `a>0`, `a≠1`, `x>0`, ainsi que les propriétés du produit, quotient et de la puissance.

Le graphique utilise une vraie scène `diagramme` et six points cohérents avec `log₂(x)` : `(0,25;−2)`, `(0,5;−1)`, `(1;0)`, `(2;1)`, `(4;2)`, `(8;3)`. Le support de courbe a été ajouté sans modifier le comportement historique des diagrammes en barres.

## Parcours réel et persistance

Le scénario Phase 13 a utilisé l'application Electron et les API preload typées : création du projet, création des scènes, génération Piper, sélection de la prise finale, synchronisation et validation des sous-titres, création/validation des déclinaisons, preview, rendus et exports.

Après fermeture et réouverture :

- titre retrouvé ;
- 10 scènes retrouvées dans le même ordre ;
- narration finale retrouvée ;
- 18 segments de sous-titres validés retrouvés ;
- déclinaisons 16:9 et 9:16 retrouvées prêtes pour rendu ;
- rendus et exports conservés ;
- snapshot de sauvegarde créé.

Résultat : **PASS**.

## Preview

La preview Remotion a été ouverte depuis l'interface réelle après fermeture/réouverture. Une capture est conservée dans `dist/phase13/phase13-preview.png`.

Résultat : **PASS**.

## Défaut bloquant découvert et correction

La première inspection visuelle a rejeté les premiers MP4 : leur durée et leurs codecs étaient valides, mais l'image affichait uniquement le placeholder « Ajoutez une scène pour commencer la prévisualisation. ».

Cause racine : avec Remotion 4.0.0, `calculateMetadata` utilisait les props entrantes pour calculer 1870 frames mais ne les retournait pas ; `composition.props` conservait alors les valeurs par défaut, dont `scenes: []`.

Correction minimale : retour explicite de `props` dans `src/remotion/Root.tsx`. Un rendu d'image unique a ensuite prouvé que les 10 scènes et 18 sous-titres atteignaient la composition avant de relancer les vidéos longues.

Les artefacts antérieurs ont été classés comme **rejetés** et ne servent pas de preuve de certification.

## Exports corrigés

| Format | Fichier | Taille | Durée | Vidéo | Audio | Checksum SHA-256 |
|---|---|---:|---:|---|---|---|
| 16:9 | `dist/phase13/exports/phase13-logarithmes-16x9.mp4` | 3 094 261 octets | 62,334 s | H.264, yuv420p, 1920×1080, 30 fps | AAC LC, mono, 48 kHz | `0da30827fc473633969c8056b461e8def0ce11f1f4d41dc839882434f0e3289d` |
| 9:16 | `dist/phase13/exports/phase13-logarithmes-9x16.mp4` | 3 104 781 octets | 62,334 s | H.264, yuv420p, 1080×1920, 30 fps | AAC LC, mono, 48 kHz | `a856204053608e67fb56093fb8e37d2939772c370c71bc1c70f0715525b65858` |
| reproduction 16:9 | `dist/phase13/exports/phase13-logarithmes-16x9-reproduction.mp4` | 3 094 627 octets | 62,334 s | H.264, yuv420p, 1920×1080, 30 fps | AAC LC, mono, 48 kHz | `bb82496714ea1ed4104aea1d4e164edaef0ff09f5fe8b9f65111c1b71835b45a` |

FFprobe et le vérificateur interne confirment des fichiers non vides, décodables, avec les streams attendus. Résultat 16:9 : **PASS**. Résultat 9:16 : **PASS**.

## Inspection visuelle

Des frames ont été extraites avec FFmpeg au début, sur des formules, sur le graphique, sur l'exercice et dans le format vertical. Elles sont conservées dans `dist/phase13/frames/`.

Constats :

- titres, textes et formules visibles sans clipping ;
- hiérarchie claire et contraste élevé ;
- sous-titres lisibles dans les zones sûres ;
- graphique lisible en 16:9 et recomposé en 9:16 ;
- application guidée mathématiquement correcte ;
- aucune donnée privée ou ressource manquante visible.

Résultat : **PASS**.

## Narration et sous-titres

- prise Piper finale réelle : checksum `e3684f4b3ead3dec807e843bf19a7b70d527da9a66191b42ed3fd3faa4c0c58d` ;
- durée source : environ 62,31 s ;
- 18 segments de sous-titres validés ;
- audio présent dans les trois exports ;
- niveau moyen : −16,1 dB ;
- crête : −1,0 dB ;
- aucune plage de silence anormal d'au moins 2 s détectée au seuil −45 dB ;
- audio décodé identique entre l'export initial et la reproduction.

Présence, continuité, niveau et inclusion : **PASS**.

Intelligibilité, prononciation des formules, absence de coupure et rythme : **PASS — validation humaine du propriétaire le 1er novembre 2026**.

## Reproductibilité

Le projet sauvegardé a été fermé, rouvert et rendu de nouveau.

- scènes : 10/10 ;
- durée : identique, écart 0 ms ;
- dimensions et codecs : identiques ;
- audio décodé : strictement identique ;
- vidéo : 1870 images dans les deux exports ;
- PSNR moyen : 71,593874 dB ;
- SSIM global : 0,999986 ;
- inspection des images divergentes : résultat visuellement identique.

Les MP4 ne sont pas binaires bit-à-bit, ce qui est autorisé par le protocole. Les faibles variations concernent surtout l'anticrénelage/encodage autour de formules et transitions.

Résultat fonctionnel : **PASS**.

## Mesures

| Étape | Mesure réelle |
|---|---:|
| scènes | 10 |
| sous-titres | 18 segments |
| rendu corrigé 16:9 | 11 min 33,3 s |
| export final 16:9 | 1 min 16,7 s |
| rendu corrigé 9:16 | 9 min 15,4 s |
| export final 9:16 | 1 min 05,8 s |
| rendu de reproduction 16:9 | 11 min 05,5 s |
| export de reproduction | 1 min 19,3 s |
| fermeture/réouverture finale | PASS, 10 scènes retrouvées |

Le temps de création consolidé n'a pas été mesuré de façon fiable à cause des relances du harnais : **NOT RUN / mesure manuelle requise**.

Friction principale : encodage logiciel lent sur cette machine, mais terminé dans les délais configurés.

## Tests et non-régression

- `pnpm typecheck` : **PASS** ;
- `pnpm lint` : **PASS** ;
- `pnpm test -- --pool=forks --maxWorkers=1 --minWorkers=1` : **PASS**, 70 fichiers, 383/383 tests, 0 fail, 0 skip ;
- `pnpm test:e2e:electron` sur le build actuel : **PASS**, 12/12 ;
- `pnpm build` : **PASS** ;
- test ciblé du diagramme : **PASS**, 3/3 ;
- aucun test Phase 12 supprimé ;
- aucune nouvelle dépendance ;
- aucun secret ni service cloud ajouté.

## Notation premium provisoire

| Critère | Score démontré | Maximum |
|---|---:|---:|
| exactitude et pédagogie | 24 | 25 |
| lisibilité et composition | 18 | 20 |
| identité visuelle | 12 | 15 |
| animations | 7 | 10 |
| qualité audio | 14 | 15 |
| sous-titres et accessibilité | 5 | 5 |
| qualité technique | 10 | 10 |
| **total démontré** | **90** | **100** |

Le seuil premium de 90/100 est atteint après validation humaine de la narration.

## Limitations et verdict

- **Mineure** : MP4 non bit-identiques ; équivalence audiovisuelle mesurée à SSIM 0,999986 et audio identique.
- **Amélioration future** : renforcer la variété visuelle et l'animation au-delà du prototype V1.

La Phase 13 est certifiable. Le checkpoint Git final reste à créer après la dernière exécution complète des tests et du build.

## Validation humaine réalisée

Le propriétaire a confirmé le 1er novembre 2026 :

1. voix intelligible du début à la fin ;
2. prononciation acceptable de `log`, bases, puissances et nombres ;
3. absence de coupure ou saturation audible ;
4. rythme cohérent avec les scènes et sous-titres ;
5. qualité globale suffisante pour attribuer 14/15 à l'audio, portant le prototype à 90/100.
