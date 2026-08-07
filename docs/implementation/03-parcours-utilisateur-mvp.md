# 03 — Parcours utilisateur MVP

## 1. Parcours principal

```text
Démarrer
→ créer projet
→ définir contenu
→ créer scènes
→ importer médias
→ ajouter narration
→ créer sous-titres
→ créer déclinaison
→ prévisualiser
→ rendre
→ vérifier
→ exporter
```

## 2. Écran d’accueil

L’écran affiche :

- projets récents ;
- bouton Nouveau projet ;
- bouton Ouvrir un projet ;
- projets archivés ;
- état des tâches en cours ;
- espace disque disponible.

## 3. Création d’un projet

Champs :

- titre ;
- type ;
- objectif ;
- public ;
- langue source ;
- format principal.

Résultat :

- dossier de projet créé ;
- ligne SQLite créée ;
- version initiale créée ;
- projet ouvert dans l’éditeur.

## 4. Éditeur de projet

Disposition recommandée :

```text
barre supérieure
├── navigation
├── sauvegarde
├── prévisualisation
├── rendu
└── export

colonne gauche
└── liste ordonnée des scènes

centre
└── canevas / lecteur / éditeur

colonne droite
└── propriétés de la scène

panneau inférieur
└── narration, sous-titres, tâches et diagnostics
```

## 5. Création d’une scène

Daniel choisit un type :

- texte ;
- formule ;
- image ;
- vidéo ;
- code ;
- diagramme ;
- capture ;
- mixte.

Puis il définit :

- titre ;
- texte affiché ;
- narration ;
- durée ;
- fond ;
- animation ;
- transition ;
- médias associés.

## 6. Import média

Le système :

1. ouvre un sélecteur ;
2. vérifie type et taille ;
3. calcule checksum ;
4. copie dans le dossier du projet ;
5. lit les métadonnées ;
6. enregistre la ressource ;
7. crée une miniature ;
8. affiche la ressource.

## 7. Narration

Deux chemins :

### Import

```text
choisir WAV/MP3
→ copier
→ analyser
→ écouter
→ associer
```

### Piper

```text
saisir ou reprendre le texte
→ choisir langue et voix
→ générer WAV
→ écouter
→ retenir ou régénérer
```

## 8. Sous-titres

Daniel peut :

- créer depuis le texte de narration ;
- éditer chaque segment ;
- régler début et fin ;
- prévisualiser ;
- exporter SRT/VTT ;
- choisir incrustés ou fichier séparé.

## 9. Déclinaison

Daniel choisit :

- 16:9 ;
- 9:16 ;
- 1:1 ;
- résolution ;
- langue ;
- profil d’export.

Le système copie la structure logique et crée une composition adaptée.

## 10. Prévisualisation

Trois niveaux :

- scène ;
- séquence ;
- déclinaison complète.

La prévisualisation utilise `@remotion/player`.

Elle ne crée pas automatiquement un export final.

## 11. Vérification

Avant le rendu, le système affiche une checklist :

- médias présents ;
- narration disponible ;
- sous-titres cohérents ;
- format défini ;
- résolution définie ;
- aucune anomalie bloquante ;
- dossier de sortie disponible ;
- espace disque suffisant.

## 12. Rendu

Étapes visibles :

```text
Préparation
→ bundle Remotion
→ rendu des images
→ audio
→ encodage
→ vérification
```

Actions :

- annuler ;
- voir progression ;
- ouvrir diagnostic ;
- relancer après correction.

## 13. Export

Après succès :

- afficher nom ;
- afficher durée ;
- afficher taille ;
- lire le fichier ;
- ouvrir le dossier ;
- copier vers un autre dossier ;
- conserver l’historique.

## 14. Sauvegarde

- sauvegarde automatique après modifications ;
- sauvegarde explicite ;
- verrouillage du projet ;
- détection de fermeture brutale ;
- restauration de session ;
- aucune donnée critique uniquement dans Zustand.

## 15. Parcours d’échec

### Média déplacé

```text
détection
→ scène marquée incomplète
→ choisir remplacement
→ recalculer checksum
→ revalidation
```

### Piper échoue

```text
diagnostic
→ texte conservé
→ nouvelle tentative
→ import manuel possible
```

### Rendu échoue

```text
tentative ECHOUEE
→ diagnostic conservé
→ projet intact
→ correction
→ nouvelle tentative
```

### Disque plein

```text
arrêt propre
→ fichiers temporaires marqués
→ message clair
→ nettoyage proposé
```

## 16. Critères d’acceptation du parcours principal

Le parcours est accepté si Daniel peut :

1. créer un projet ;
2. ajouter trois scènes ;
3. importer une image ;
4. générer une voix ;
5. ajouter des sous-titres ;
6. prévisualiser ;
7. produire un MP4 ;
8. fermer ;
9. rouvrir ;
10. retrouver le même projet et l’historique du rendu.
