# 00 — Vision produit et périmètre MVP

## 1. Nom du produit

**SCPT — Studio de Création Pédagogique et Technique**

Application de bureau locale permettant à Daniel de concevoir, prévisualiser, rendre et exporter des vidéos pédagogiques, techniques, institutionnelles et promotionnelles.

## 2. Utilisateur

Le noyau initial est **mono-utilisateur**.

```text
Utilisateur humain : Daniel
```

Il n’existe pas de rôles auteur, réviseur, opérateur ou publicateur dans le MVP. Ces mots désignent des étapes de travail effectuées par Daniel.

## 3. Problème résolu

Produire une vidéo pédagogique ou technique exige actuellement plusieurs outils séparés : rédaction, diapositives, voix, animation, montage, sous-titres et export.

Le SCPT unifie ce parcours :

```text
Projet
→ contenu
→ scènes
→ médias
→ narration
→ sous-titres
→ prévisualisation
→ rendu
→ export
```

## 4. Proposition de valeur

Le SCPT doit permettre de créer une vidéo cohérente sans dépendre obligatoirement :

- d’un service cloud ;
- d’une API payante ;
- d’un avatar ;
- d’un éditeur vidéo externe ;
- d’une connexion permanente.

## 5. Types de contenus du MVP

Le MVP prend en charge :

- leçon pédagogique ;
- exercice corrigé ;
- tutoriel technique ;
- démonstration logicielle ;
- présentation d’un logiciel ;
- vidéo promotionnelle simple ;
- capsule courte.

## 6. Formats de sortie du MVP

- horizontal 16:9 ;
- vertical 9:16 ;
- carré 1:1 ;
- MP4 H.264 + AAC ;
- sous-titres SRT et VTT ;
- français comme langue source ;
- anglais comme première langue cible après stabilisation du français.

## 7. Fonctionnalités obligatoires du MVP

### Projets

- créer ;
- ouvrir ;
- modifier ;
- enregistrer ;
- dupliquer ;
- archiver ;
- restaurer.

### Contenu

- définir titre, objectif, public et type ;
- rédiger narration et texte affiché séparément ;
- créer une suite ordonnée de scènes ;
- réordonner les scènes ;
- dupliquer ou supprimer une scène.

### Scènes

- titre ;
- texte ;
- formule KaTeX ;
- image ;
- vidéo ;
- code ;
- diagramme simple ;
- capture d’écran ;
- fond ;
- durée ;
- transition ;
- animation prédéfinie.

### Médias

- importer ;
- référencer localement ;
- détecter un fichier manquant ;
- conserver la source ;
- produire des dérivations ;
- afficher les métadonnées.

### Audio

- importer une narration ;
- générer une narration avec Piper ;
- écouter ;
- remplacer ;
- sélectionner la prise finale ;
- régler volume et silences.

### Sous-titres

- créer une piste ;
- éditer les segments ;
- synchroniser ;
- exporter SRT/VTT ;
- afficher ou incruster au rendu.

### Prévisualisation

- prévisualiser une scène ;
- prévisualiser une séquence ;
- prévisualiser la déclinaison complète ;
- choisir le format cible.

### Rendu

- lancer un rendu ;
- suivre la progression ;
- annuler ;
- reprendre après correction ;
- conserver les diagnostics ;
- vérifier le fichier final.

### Export

- créer un fichier MP4 ;
- choisir un dossier ;
- nommer automatiquement ;
- conserver le profil et la version ;
- ouvrir le dossier de sortie.

## 8. Hors périmètre du MVP

Ne pas implémenter dans le MVP :

- multi-utilisateur ;
- comptes d’équipe ;
- rôles et permissions complexes ;
- collaboration temps réel ;
- microservices ;
- backend web distant obligatoire ;
- application mobile ;
- synchronisation cloud ;
- publication automatique ;
- marketplace de modèles ;
- avatar obligatoire ;
- génération d’images par API ;
- génération de texte par API ;
- paiement ;
- abonnement ;
- analytics cloud ;
- montage vidéo libre comparable à Premiere Pro ;
- IA autonome qui décide du contenu à la place de Daniel.

## 9. Principes produit

1. Local-first.
2. Mono-utilisateur.
3. Hors ligne par défaut.
4. Données exportables.
5. Sources conservées.
6. Rendu reproductible.
7. Historique non destructif.
8. Interface claire.
9. Fonctionnalités installées par phase.
10. Aucune fonctionnalité future ne doit compliquer le MVP.

## 10. Définition du livrable final

Le livrable final est une application Windows installable permettant de :

1. créer un projet ;
2. construire plusieurs scènes ;
3. importer des médias ;
4. ajouter ou générer une voix ;
5. créer des sous-titres ;
6. prévisualiser ;
7. rendre avec Remotion ;
8. encoder avec FFmpeg ;
9. exporter un MP4 vérifié ;
10. rouvrir le projet sans perte de données.

## 11. Critères de réussite

Le MVP est accepté si :

- il fonctionne sur Windows 11 ;
- il fonctionne sans Internet pour les fonctions principales ;
- un projet complet peut être créé et rouvert ;
- le rendu peut être annulé ;
- un échec de rendu est diagnostiqué ;
- le MP4 final est lisible ;
- les sources ne sont pas écrasées ;
- la documentation Codex permet de reconstruire le projet ;
- aucun rôle collaboratif n’apparaît dans l’interface ;
- aucune API payante n’est requise.
