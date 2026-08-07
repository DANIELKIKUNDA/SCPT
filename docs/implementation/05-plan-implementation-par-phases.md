# 05 — Plan d’implémentation par phases

## 1. Règle absolue

Codex travaille sur **une seule phase active**.

Il ne doit pas anticiper une phase ultérieure.

Chaque phase se termine par :

- code ;
- tests ;
- documentation minimale ;
- démonstration ;
- commit ;
- critères de sortie validés.

---

# Phase 0 — Initialisation du dépôt

## Objectif

Créer un projet Electron + React + TypeScript minimal avec pnpm.

## Livrables

- dépôt Git ;
- `package.json` ;
- `pnpm-lock.yaml` ;
- electron-vite ;
- React ;
- TypeScript strict ;
- ESLint ;
- Prettier ;
- Vitest ;
- fenêtre Electron ;
- IPC de test ;
- README de démarrage.

## Commandes

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
```

## Critère de sortie

Une fenêtre Electron sécurisée affiche l’écran d’accueil.

---

# Phase 1 — Fondations et sécurité Electron

## Objectif

Stabiliser main, preload, renderer et IPC.

## À implémenter

- `contextIsolation` ;
- `nodeIntegration: false` ;
- API preload ;
- contrats Zod ;
- gestion d’erreurs ;
- logs Pino ;
- dossier de données ;
- préférences locales ;
- fermeture propre.

## Tests

- le renderer n’accède pas à Node ;
- IPC invalide refusé ;
- erreur main traduite ;
- redémarrage propre.

## Livrable

Socle desktop sécurisé.

---

# Phase 2 — Projets et stockage local

## Objectif

Créer, ouvrir, enregistrer, archiver et restaurer un projet.

## Dépendances à ajouter

- `better-sqlite3`
- `drizzle-orm`
- `drizzle-kit`
- `fs-extra`
- `proper-lockfile`
- `ulid`
- `date-fns`

## À implémenter

- dossier physique ;
- `project.scpt.json` ;
- migrations SQLite ;
- repository projet ;
- cas d’usage ;
- écran accueil ;
- formulaire de création ;
- liste récente ;
- sauvegarde ;
- verrouillage ;
- archive.

## Tests

- création ;
- réouverture ;
- conflit de verrou ;
- migration ;
- projet corrompu ;
- archivage.

## Livrable

Gestion fiable des projets.

---

# Phase 3 — Modèle de scènes et éditeur

## Objectif

Construire une séquence de scènes.

## Dépendances

- `zustand`
- `react-hook-form`
- `@hookform/resolvers`
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `react-resizable-panels`
- `lucide-react`
- `sonner`

## À implémenter

- entité Scene ;
- repository ;
- création ;
- duplication ;
- suppression ;
- réordonnancement ;
- panneau propriétés ;
- autosave ;
- historique minimal ;
- types texte, formule, image, code.

## Tests

- ordre unique ;
- durée positive ;
- réordonnancement atomique ;
- autosave ;
- restauration après fermeture.

## Livrable

Éditeur de scènes utilisable.

---

# Phase 4 — Médias locaux

## Objectif

Importer et gérer les ressources.

## Dépendances

- `file-type`
- `mime-types`
- `sharp`
- `music-metadata`
- `sanitize-filename`
- `chokidar`

## À implémenter

- import ;
- checksum ;
- copie source ;
- métadonnées ;
- miniature ;
- bibliothèque ;
- association à une scène ;
- détection fichier manquant ;
- remplacement ;
- dérivation.

## Tests

- type réel ;
- doublon ;
- source conservée ;
- fichier déplacé ;
- média interdit ;
- miniature.

## Livrable

Bibliothèque média locale fiable.

---

# Phase 5 — Moteur de composition et prévisualisation

## Objectif

Afficher une vidéo dynamique dans l’application.

## Dépendances

- `remotion`
- `@remotion/player`
- `katex`
- `react-katex`
- `@monaco-editor/react`
- `recharts`

## À implémenter

- root Remotion ;
- composition ;
- scène texte ;
- formule ;
- image ;
- code ;
- diagramme simple ;
- transition ;
- thème ;
- lecteur ;
- prévisualisation scène et projet.

## Tests

- durée ;
- rendu déterministe ;
- scène manquante ;
- formule invalide ;
- format 16:9.

## Livrable

Prévisualisation complète sans export final.

---

# Phase 6 — Narration locale

## Objectif

Importer ou générer une voix.

## Dépendances

- `wavesurfer.js`
- `execa`
- `p-queue`
- `p-limit`

## Ressources

- binaire Piper ;
- modèle français ;
- configuration des voix.

## À implémenter

- piste narration ;
- segments ;
- import audio ;
- génération Piper ;
- écoute ;
- forme d’onde ;
- sélection prise finale ;
- durée ;
- erreurs ;
- annulation.

## Tests

- Piper absent ;
- texte vide ;
- WAV produit ;
- remplacement ;
- durée modifiée ;
- reprise.

## Livrable

Narration locale fonctionnelle.

---

# Phase 7 — Sous-titres

## Objectif

Créer, synchroniser et exporter les sous-titres.

## À implémenter

- piste ;
- segments ;
- édition ;
- timeline ;
- SRT ;
- VTT ;
- incrustation Remotion ;
- invalidation après changement de narration.

## Tests

- intervalles ;
- chevauchements ;
- export ;
- caractères spéciaux ;
- resynchronisation.

## Livrable

Sous-titres complets.

---

# Phase 8 — Déclinaisons multi-format

## Objectif

Produire 16:9, 9:16 et 1:1.

## À implémenter

- agrégat déclinaison ;
- résolution ;
- profil ;
- zones de sécurité ;
- recomposition ;
- aperçu par format ;
- statut obsolète.

## Tests

- format ;
- résolution ;
- surcharge ;
- version source ;
- vertical non validé par simple recadrage.

## Livrable

Déclinaisons visuelles.

---

# Phase 9 — Rendu Remotion

## Objectif

Créer une tâche de rendu locale.

## Dépendances

- `@remotion/renderer`
- `@remotion/bundler`

## À implémenter

- bundle ;
- file de tâches ;
- progression ;
- annulation ;
- reprise ;
- tentative ;
- logs ;
- fichiers temporaires ;
- limite de concurrence.

## Tests

- succès ;
- échec ;
- annulation ;
- double demande ;
- fermeture application ;
- relance.

## Livrable

Vidéo intermédiaire rendue.

---

# Phase 10 — FFmpeg et export final

## Objectif

Encoder et vérifier le MP4 final.

## Dépendances

- `ffmpeg-static`
- `ffprobe-static`

## À implémenter

- wrapper FFmpeg ;
- wrapper FFprobe ;
- mixage ;
- H.264 ;
- AAC ;
- MP4 ;
- normalisation audio ;
- nom de fichier ;
- checksum ;
- vérification ;
- ouverture dossier.

## Tests

- FFmpeg absent ;
- disque plein ;
- fichier corrompu ;
- audio absent ;
- durée incorrecte ;
- export immuable.

## Livrable

MP4 final vérifié.

---

# Phase 11 — Qualité, récupération et historique

## Objectif

Rendre le produit robuste.

## À implémenter

- audit minimal ;
- anomalies ;
- checklist ;
- backups ;
- restauration ;
- nettoyage temporaires ;
- diagnostics ;
- tableau des tâches ;
- versionnement ;
- obsolescence.

## Tests

- crash ;
- reprise ;
- ancienne version ;
- export conservé ;
- média remplacé ;
- audit.

## Livrable

Produit récupérable et traçable.

---

# Phase 12 — Expérience premium du MVP

## Objectif

Finaliser l’interface et la stabilité.

## À implémenter

- raccourcis ;
- onboarding ;
- états vides ;
- accessibilité ;
- performance ;
- messages ;
- thèmes ;
- miniatures ;
- préférences ;
- installateur.

## Tests

- Playwright Electron ;
- projet complet ;
- faible espace disque ;
- Windows x64 ;
- installation/désinstallation ;
- réouverture.

## Livrable

Release candidate.

---

# Phase 13 — Prototype de validation

## Objectif

Créer une vidéo pédagogique réelle sur les logarithmes.

## Parcours

- projet ;
- scènes ;
- formule ;
- graphique ;
- voix ;
- sous-titres ;
- prévisualisation ;
- 16:9 ;
- 9:16 ;
- MP4 final.

## Critères

- aucune donnée perdue ;
- rendu reproductible ;
- voix intelligible ;
- sous-titres lisibles ;
- formule correcte ;
- réouverture possible ;
- export vérifié.

## Livrable

Projet exemple + vidéos finales.

---

# Phase 14 — Livraison finale

## Livrables obligatoires

- code source ;
- installateur Windows ;
- lockfile ;
- migrations ;
- binaires et modèles autorisés ;
- documentation d’installation ;
- documentation utilisateur ;
- documentation de dépannage ;
- projet exemple ;
- tests ;
- rapport de qualité ;
- liste des limitations connues ;
- numéro de version.

## Commandes finales

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm package:win
```

## Critère final

Toutes les commandes passent et l’installateur produit un SCPT fonctionnel hors ligne.
