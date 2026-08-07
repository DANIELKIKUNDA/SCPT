# 10 — Standard premium visuel, sonore et critères d’acceptation

## 1. Objet

Ce document définit ce que signifie « premium » pour une vidéo produite par le SCPT.

Une vidéo n’est pas considérée premium uniquement parce qu’elle est rendue sans erreur. Elle doit satisfaire des critères visuels, sonores, pédagogiques, techniques et d’accessibilité.

Ce document est normatif.

---

## 2. Principe général

```text
Qualité premium
= clarté pédagogique
+ identité visuelle cohérente
+ animations maîtrisées
+ audio propre
+ sous-titres lisibles
+ rendu technique vérifié
```

Aucun de ces éléments ne peut être remplacé par un simple effet visuel.

---

## 3. Système visuel canonique

### 3.1. Grille

- grille de base : 8 px ;
- marges horizontales minimales : 64 px en 16:9 ;
- marges verticales minimales : 48 px en 16:9 ;
- respect des zones sûres en 9:16 et 1:1 ;
- alignement sur grille ;
- pas d’élément visuel flottant sans logique.

### 3.2. Typographie

Familles autorisées :

- une police principale sans sérif ;
- une police monospace pour le code ;
- KaTeX pour les mathématiques.

Règles :

- titre principal : 56 à 72 px en 1080p ;
- titre secondaire : 36 à 48 px ;
- texte courant : 28 à 36 px ;
- sous-titres : 36 à 44 px ;
- code : 26 à 34 px ;
- maximum deux familles typographiques par vidéo ;
- contraste suffisant ;
- interlignage confortable ;
- aucune ligne trop longue.

### 3.3. Couleurs

Le système doit définir :

- couleur primaire ;
- couleur secondaire ;
- couleur d’accent ;
- fond clair ;
- fond sombre ;
- texte principal ;
- texte secondaire ;
- succès ;
- avertissement ;
- erreur.

Règles :

- contraste WCAG AA au minimum ;
- couleur d’accent utilisée avec parcimonie ;
- aucune couleur décorative sans fonction ;
- cohérence sur toutes les scènes ;
- palette enregistrée dans un thème réutilisable.

### 3.4. Formes et profondeur

- coins arrondis cohérents ;
- ombres légères ;
- séparation claire des plans ;
- pas d’abus de flou ;
- pas d’effets 3D inutiles ;
- pas de surcharge décorative.

---

## 4. Bibliothèque obligatoire de modèles de scènes

Le MVP premium doit fournir au minimum :

1. ouverture de marque ;
2. titre de leçon ;
3. objectif ;
4. définition ;
5. explication simple ;
6. formule mathématique ;
7. graphique ;
8. tableau comparatif ;
9. démonstration étape par étape ;
10. code source ;
11. capture d’écran annotée ;
12. exemple ;
13. exercice ;
14. correction ;
15. erreur fréquente ;
16. résumé ;
17. conclusion ;
18. appel à l’action.

Chaque modèle doit définir :

- structure ;
- zones ;
- taille de texte ;
- animation ;
- durée recommandée ;
- variante claire ;
- variante sombre ;
- adaptation 16:9 ;
- adaptation 9:16 ;
- adaptation 1:1.

---

## 5. Règles d’animation

### 5.1. Principes

- l’animation guide l’attention ;
- elle ne remplace pas l’explication ;
- elle reste courte ;
- elle respecte une courbe d’accélération naturelle ;
- elle ne crée pas de distraction.

### 5.2. Durées

- apparition simple : 200 à 450 ms ;
- transition de scène : 300 à 700 ms ;
- accentuation : 150 à 350 ms ;
- mouvement complexe : 500 à 1200 ms.

### 5.3. Interdictions

- clignotement ;
- zoom agressif ;
- rotation gratuite ;
- mouvement permanent ;
- plus de trois animations simultanées ;
- effets non justifiés par le contenu ;
- transition différente à chaque scène sans logique.

### 5.4. Mouvement réduit

Le système doit pouvoir réduire les animations pour l’accessibilité.

---

## 6. Règles de composition

- une idée principale par scène ;
- hiérarchie claire ;
- élément focal identifiable ;
- espace négatif suffisant ;
- texte affiché distinct de la narration ;
- pas de paragraphe dense ;
- maximum recommandé : 35 mots visibles par scène ;
- éviter plus de 6 éléments principaux ;
- progression visuelle cohérente.

---

## 7. Mathématiques

Les scènes mathématiques doivent :

- utiliser KaTeX ;
- respecter la notation ;
- éviter les images floues de formules ;
- faire apparaître les étapes progressivement ;
- distinguer hypothèse, transformation et résultat ;
- utiliser une couleur d’accent pour l’étape active ;
- rester lisibles en 9:16 ;
- offrir une vérification visuelle des symboles.

---

## 8. Programmation

Les scènes de code doivent :

- utiliser une police monospace ;
- afficher la coloration syntaxique ;
- limiter le nombre de lignes visibles ;
- mettre en évidence la ligne expliquée ;
- éviter les captures illisibles ;
- conserver une taille suffisante ;
- séparer code, résultat et explication ;
- masquer les secrets et données privées.

---

## 9. Audio premium

### 9.1. Narration

- voix intelligible ;
- rythme naturel ;
- pauses cohérentes ;
- prononciation vérifiée ;
- aucun souffle gênant ;
- aucune saturation ;
- aucune coupure brutale.

### 9.2. Cibles

- fréquence d’échantillonnage : 48 kHz ;
- niveau de crête maximal recommandé : -1 dBTP ;
- niveau moyen cible : environ -16 LUFS pour contenu en ligne ;
- bruit de fond faible ;
- absence de clipping.

### 9.3. Musique

- facultative ;
- plus faible que la narration ;
- ducking automatique ou manuel ;
- jamais utilisée pour masquer une mauvaise voix ;
- licence connue ;
- fondu d’entrée et de sortie.

### 9.4. Effets sonores

- sobres ;
- fonctionnels ;
- courts ;
- cohérents avec l’identité ;
- jamais répétitifs au point de fatiguer.

---

## 10. Sous-titres

- maximum deux lignes ;
- longueur raisonnable ;
- synchronisation avec la parole ;
- contraste élevé ;
- fond ou contour si nécessaire ;
- ponctuation correcte ;
- respect des zones sûres ;
- pas de chevauchement avec les éléments importants ;
- export SRT/VTT ;
- option d’incrustation.

---

## 11. Rythme pédagogique

- introduction rapide ;
- objectif explicite ;
- progression logique ;
- exemples ;
- pauses ;
- résumé ;
- conclusion.

Règles :

- éviter les longues scènes statiques ;
- éviter les changements trop rapides ;
- une scène doit durer assez longtemps pour être comprise ;
- les informations complexes sont découpées ;
- les silences courts sont autorisés.

---

## 12. Formats

### 16:9
- référence principale ;
- 1920 × 1080 ;
- zones sûres ;
- composition horizontale.

### 9:16
- 1080 × 1920 ;
- recomposition réelle ;
- pas de simple recadrage ;
- textes plus grands ;
- éléments essentiels centrés.

### 1:1
- 1080 × 1080 ;
- composition équilibrée ;
- lecture mobile.

---

## 13. Export technique premium

Profil MVP :

- MP4 ;
- H.264 ;
- AAC ;
- yuv420p ;
- 30 fps ;
- audio 48 kHz ;
- débit adapté au contenu ;
- métadonnées correctes ;
- aucun écran noir initial ou final involontaire ;
- aucun frame manquant ;
- aucun décalage audio/vidéo.

---

## 14. Contrôle qualité obligatoire

Avant export final, vérifier :

### Visuel
- alignements ;
- contraste ;
- lisibilité ;
- cohérence ;
- zones sûres ;
- absence de médias manquants.

### Audio
- voix ;
- volume ;
- bruit ;
- synchronisation ;
- musique.

### Pédagogie
- objectif ;
- exactitude ;
- progression ;
- exemples ;
- conclusion.

### Technique
- format ;
- résolution ;
- durée ;
- codecs ;
- fichier lisible ;
- checksum.

---

## 15. Grille de notation

Chaque vidéo est notée sur 100 :

- exactitude et pédagogie : 25 ;
- lisibilité et composition : 20 ;
- identité visuelle : 15 ;
- animations : 10 ;
- qualité audio : 15 ;
- sous-titres et accessibilité : 5 ;
- qualité technique de l’export : 10.

### Seuils

- 90 à 100 : premium validé ;
- 80 à 89 : bon niveau, corrections mineures ;
- 70 à 79 : acceptable, non premium ;
- moins de 70 : refusé.

Aucune vidéo ne peut être premium si :

- une formule est fausse ;
- un média manque ;
- l’audio sature ;
- les sous-titres sont illisibles ;
- le rendu est corrompu ;
- une licence est inconnue ;
- une donnée privée apparaît.

---

## 16. Prototype de référence

Le projet sur les logarithmes sert de benchmark.

Il doit contenir :

- ouverture ;
- objectif ;
- définition ;
- relation exponentielle-logarithme ;
- graphique ;
- exemple ;
- exercice ;
- correction ;
- résumé ;
- conclusion ;
- narration ;
- sous-titres ;
- version 16:9 ;
- version 9:16.

Il doit obtenir au moins 90/100 avant que le MVP soit déclaré premium.

---

## 17. Definition of Premium

Le SCPT est déclaré capable de produire des vidéos premium uniquement si :

1. les modèles de scènes obligatoires existent ;
2. le design system est appliqué ;
3. les règles audio sont respectées ;
4. les formats sont réellement adaptés ;
5. les contrôles qualité sont automatisés autant que possible ;
6. le prototype obtient au moins 90/100 ;
7. les exports sont techniquement vérifiés ;
8. le projet peut être rouvert et reproduit.
