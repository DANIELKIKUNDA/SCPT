# 09 — Procédure de verrouillage des versions et compatibilités

## 1. Principe
Une version n’est pas considérée compatible parce qu’elle est récente. Elle doit être installée, construite, packagée et testée.

## 2. Rapport obligatoire
Codex crée en phase 0 :

`docs/implementation/10-rapport-compatibilite-versions.md`

Table minimale :

| Élément | Version exacte | Build | Packaging | Test installé | Décision |
|---|---:|---|---|---|---|
| pnpm | | | n/a | | |
| Node développement | | | n/a | | |
| Electron | | | | | |
| React | | | | | |
| TypeScript | | | n/a | n/a | |
| electron-vite | | | | | |
| electron-builder | | n/a | | | |

Les dépendances critiques des phases suivantes sont ajoutées lorsqu’elles entrent dans le projet.

## 3. Contrôles
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm package:win
```

## 4. Incompatibilité
1. ne pas changer d’architecture ;
2. isoler la dépendance ;
3. vérifier sa compatibilité officielle ;
4. sélectionner une version stable compatible ;
5. documenter ;
6. refaire tous les contrôles ;
7. mettre à jour lockfile et rapport.

## 5. Interdictions
- pas de `latest` permanent ;
- pas de `*` ;
- pas de npm/yarn ;
- pas de suppression du lockfile ;
- pas d’erreur native tolérée ;
- pas de validation sur le seul build renderer ;
- pas de validation sans test de l’application installée.

## 6. Critère
Une version est verrouillée si :
- elle est exacte dans le graphe pnpm ;
- le lockfile est commité ;
- typecheck, lint et tests passent ;
- build et package passent lorsqu’applicables ;
- l’application installée fonctionne ;
- le rapport est mis à jour.
