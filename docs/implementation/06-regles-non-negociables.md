# 06 — Règles non négociables

## 1. Priorité documentaire

Ordre de priorité :

```text
06-regles-non-negociables
→ 05-plan-implementation-par-phases
→ autres documents implementation
→ reference
→ archive
```

## 2. Produit

1. Le SCPT est une application de bureau.
2. Daniel est l’unique utilisateur humain du MVP.
3. Le MVP est local-first.
4. Le cœur fonctionne hors ligne.
5. Aucune API payante n’est obligatoire.
6. L’avatar est facultatif.
7. La publication automatique est hors MVP.

## 3. Architecture

1. pnpm est obligatoire.
2. Electron + React + TypeScript est la pile d’interface.
3. electron-vite est l’outil de build.
4. Remotion compose la vidéo.
5. FFmpeg traite et encode.
6. Piper génère la voix locale.
7. SQLite stocke les données structurées.
8. Les fichiers lourds restent sur disque.
9. Le domaine ne dépend d’aucun framework.
10. Le renderer ne possède pas d’accès Node direct.

## 4. Dépendances

1. Installer une dépendance uniquement dans sa phase.
2. Expliquer son rôle avant installation.
3. Ne pas ajouter deux bibliothèques qui résolvent le même problème sans décision.
4. Ne pas remplacer une dépendance canonique sans mise à jour documentaire.
5. Conserver `pnpm-lock.yaml`.
6. Interdire les versions flottantes.
7. Tester les modules natifs dans l’application packagée.

## 5. Code

1. TypeScript strict.
2. Pas de `any` non justifié.
3. Pas de logique métier dans React.
4. Pas d’accès SQLite depuis le renderer.
5. Pas de FFmpeg, Piper ou Remotion dans le domaine.
6. Pas de chemin absolu métier.
7. Pas de fonction géante.
8. Pas de duplication d’invariant.
9. Pas d’exception technique brute dans l’interface.
10. Chaque cas d’usage sensible est testé.

## 6. Sécurité

1. `contextIsolation: true`.
2. `nodeIntegration: false`.
3. API preload minimale.
4. Tous les appels IPC validés par Zod.
5. Aucune commande shell concaténée.
6. Aucun secret dans le renderer, les logs ou les projets.
7. Chemins normalisés.
8. Types de fichiers vérifiés.
9. Confirmation avant suppression, archivage, rendu final et publication.
10. Les sources ne sont jamais écrasées.

## 7. Données

1. Les projets sont rouvrables.
2. Les migrations sont versionnées.
3. Les exports réussis sont immuables.
4. Les anciennes versions restent consultables.
5. Les déclinaisons obsolètes ne sont pas utilisées comme courantes.
6. Les temporaires sont distincts des sources.
7. Les sauvegardes sont testées.
8. La fermeture brutale ne doit pas détruire le projet.

## 8. Phases

1. Une seule phase active.
2. Pas de code de phase future.
3. Chaque phase a des critères de sortie.
4. Les tests passent avant changement de phase.
5. Un commit marque la fin d’une phase.
6. Toute déviation est documentée.
7. Une phase échouée est corrigée, pas contournée.

## 9. Interdictions MVP

Ne pas implémenter :

- multi-utilisateur ;
- rôles ;
- organisations ;
- microservices ;
- backend web ;
- Docker ;
- Redis ;
- Kafka ;
- cloud obligatoire ;
- synchronisation distante ;
- paiement ;
- abonnement ;
- publication automatique ;
- collaboration ;
- IA générative obligatoire ;
- application mobile.

## 10. Instruction officielle à Codex

```text
Lis uniquement les documents du dossier docs/implementation.

Respecte l’ordre de priorité documentaire.
Travaille uniquement sur la phase explicitement active.
N’installe que les dépendances prévues dans cette phase.
Avant tout changement, identifie les fichiers concernés et explique leur rôle.
N’anticipe aucune fonctionnalité future.
En cas de contradiction, applique 06-regles-non-negociables.md.
À la fin de la tâche, exécute les tests pertinents et liste précisément les fichiers modifiés.
```

## 11. Definition of Done

Une tâche est terminée uniquement si :

- le code compile ;
- le typecheck passe ;
- le lint passe ;
- les tests concernés passent ;
- aucune règle non négociable n’est violée ;
- les fichiers modifiés sont listés ;
- les limitations sont déclarées ;
- la documentation de la phase est à jour.
