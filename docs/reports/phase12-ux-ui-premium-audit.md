# SCPT — Phase 12 — Audit UX/UI premium

## Périmètre audité

- totalité de la documentation locale `docs/implementation` et `docs/reports` du checkpoint transmis ;
- renderer React actuel (`App`, workspace, scènes, prévisualisation, narration, sous-titres, médias, déclinaisons, rendu, export, fiabilité) ;
- documentation SCPT accessible dans le dossier Google Drive « Studio de Création Pédagogique et Technique » : gouvernance, pédagogie, cycle de vie, formats, déclinaisons et positionnement.

## Diagnostic

Le socle fonctionnel est riche et cohérent, mais l’interface héritée des phases techniques se présente encore comme un outil de diagnostic/développement : statut React/Electron/IPC en premier plan, page d’accueil étroite, hiérarchie visuelle faible, préférences techniques exposées comme contenu principal et manque de proposition de valeur.

L’éditeur possède déjà la bonne architecture métier (scènes à gauche, canevas au centre, propriétés à droite, outils de production en bas), mais sa peau visuelle reste dense et uniforme. La Phase 12 doit donc préserver cette architecture tout en transformant la perception du produit : de « prototype technique fonctionnel » vers « studio audiovisuel desktop professionnel ».

## Doctrine UX retenue

1. Le projet audiovisuel est l’objet principal ; la technique reste secondaire.
2. L’accueil doit aider à commencer ou reprendre une production en moins de quelques secondes.
3. La hiérarchie doit refléter le cycle réel : projet → scènes → production → prévisualisation → rendu/export.
4. Les états vides doivent guider au lieu de seulement constater l’absence de données.
5. Les préférences d’apparence et d’accessibilité doivent être disponibles sans dominer l’espace de travail.
6. Le mode sombre est adapté au travail audiovisuel, mais clair/système doivent être réellement appliqués.
7. L’interface doit rester calme : profondeur légère, accent fonctionnel, animations sobres et désactivables.
8. Le studio doit rester multi-usage : pédagogique, technique, démonstration, institutionnel, promotionnel et publicitaire.

## Première tranche implémentée dans ce checkpoint

- nouveau shell d’accueil premium et responsive ;
- identité SCPT complète et proposition de valeur ;
- hero orienté création audiovisuelle ;
- CTA « Nouveau projet » / « Reprendre un projet » ;
- onboarding léger de première utilisation ;
- formulaire de création restructuré et hiérarchisé ;
- état vide guidé ;
- cartes projets modernisées ;
- thème clair / sombre / système réellement appliqué au DOM ;
- préférence « réduire les animations » réellement appliquée ;
- état technique déplacé dans une carte discrète ;
- skin premium du workspace sans modifier les workflows métier ;
- focus clavier renforcé ;
- raccourcis Ctrl+S et Ctrl+Z dans l’éditeur ;
- tests `App` réalignés sur le shell Phase 12.

## Ce qui reste avant certification Phase 12

Cette tranche n’est pas la certification de Phase 12. Restent notamment : audit écran par écran des panneaux métier, états vides/chargement/erreur de chaque outil, miniatures et cohérence iconographique, E2E Playwright Electron, scénarios faible espace disque, installation/désinstallation/réouverture Windows, icône applicative, version de release candidate et validation finale sur le vrai Windows.
