# SCPT — Rapport d’implémentation Phase 11

## Statut

**Phase 11 implémentée — candidate à certification Windows.**

Cette implémentation couvre le périmètre canonique « Qualité, récupération et historique » : audit minimal, anomalies, checklist, backups/restauration, nettoyage des temporaires, diagnostics, tableau des tâches, versionnement et obsolescence. Elle n’introduit aucune dépendance supplémentaire et ne commence aucune fonctionnalité de Phase 12.

La Phase 11 ne sera déclarée définitivement figée qu’après les gates Windows sur `C:\Dev\SCPT` et une certification fonctionnelle réelle de crash/reprise/restauration.

## Baseline

Baseline d’entrée : **SCPT Phase 10 définitivement figée**.

Commit certifié communiqué pour la Phase 10 :

`6d3d708db4ea2c4ab234b530d158837fe48473d0`

Gates Phase 10 communiqués : 59/59 fichiers de tests, 342/342 tests, typecheck PASS, lint PASS 0 warning, build PASS, Electron réel PASS, export MP4 final réel PASS.

## Dépendances

Aucune nouvelle dépendance.

`package.json` et `pnpm-lock.yaml` restent byte-for-byte identiques à la baseline Phase 10.

La Phase 11 réutilise exclusivement les briques déjà présentes : Electron, SQLite/better-sqlite3, Node `fs`/`crypto`, Pino et les coordinators Remotion/FFmpeg existants.

## Versionnement physique du projet

`project.scpt.json` devient l’enveloppe physique de récupération/versionnement sans dupliquer les données métier SQLite.

Version courante :

- `MANIFEST_FORMAT_VERSION = 2` ;
- `DATABASE_SCHEMA_VERSION = 1`.

Le manifeste conserve notamment :

- version de format ;
- version de schéma de récupération ;
- version SCPT de création/dernière ouverture ;
- dernière ouverture ;
- dernière fermeture propre ;
- dernier audit ;
- dernier snapshot ;
- dernière restauration.

Une version de manifeste plus récente que l’application est refusée fail-closed (`PROJECT_FORMAT_NEWER_THAN_APP`).

Les anciens projets Phase 0–10 sans manifeste physique sont bootstrapés comme legacy puis migrés par le chemin normal.

## Migration Phase 11

Deux tables sont ajoutées de façon idempotente dans la base projet :

- `audit_entries` ;
- `migrations`.

L’identifiant de migration est `phase11-reliability-v1`.

Avant migration d’un projet legacy, SCPT crée obligatoirement un snapshot de type `migration` afin de préserver l’état antérieur.

## Détection de fermeture brutale et reprise

Chaque projet ouvert possède un marqueur local `recovery/active-session.json` contenant un identifiant de session, le projet, le PID et l’heure d’ouverture.

- ouverture : détection d’un marqueur précédent ;
- crash détecté : nettoyage des temporaires abandonnés puis nouveau marqueur ;
- fermeture propre : snapshot si nécessaire, suppression du marqueur, mémorisation `lastCleanCloseAt` ;
- redémarrage : les mécanismes Phase 9/10 de récupération des rendus/exports restent actifs.

Le marqueur n’est supprimé qu’au chemin de fermeture propre.

## Audit minimal et anomalies

`ProjectAuditService` contrôle :

- version du manifeste et du schéma ;
- présence des répertoires obligatoires ;
- présence et `PRAGMA integrity_check` de SQLite ;
- présence/checksum des médias référencés ;
- tâches de rendu/export interrompues ;
- présence/checksum des rendus terminés ;
- présence/checksum des exports finaux immuables ;
- déclinaisons historiques obsolètes ;
- temporaires abandonnés ;
- présence d’au moins un point de récupération ;
- détection d’une session précédente non fermée proprement.

Les audits sont historisés en SQLite avec trois états :

- `healthy` ;
- `attention` ;
- `blocked`.

La checklist synthétise : version, base, médias, sorties, tâches, temporaires et sauvegarde.

## Snapshots de récupération

`ProjectBackupService` crée des snapshots atomiques dans `backups/` via un répertoire `.building-*` puis renommage final.

Chaque snapshot contient :

- manifeste de snapshot versionné ;
- copie SQLite cohérente via l’API `better-sqlite3.backup()` ;
- fichiers durables appartenant au projet ;
- taille et SHA-256 de chaque fichier ;
- fingerprint de l’état source ;
- version SCPT, format et schéma.

Racines durables sauvegardées :

- `media/source` ;
- `audio/narration` ;
- `audio/music` ;
- `subtitles` ;
- `renders/previews` ;
- `renders/final`.

Sont volontairement exclus des snapshots de restauration :

- `audio/temp` ;
- `media/thumbnails` ;
- `media/derived` ;
- `renders/failed` ;
- `logs` ;
- `temp/**`.

Cette exclusion empêche de ressusciter des données recréables/stales et évite qu’un fichier opérationnel naturellement modifié après le snapshot bloque une restauration par conflit de checksum.

Les liens symboliques sont refusés dans les arbres sauvegardés.

## Cadence et rétention

Types de snapshots :

- automatique ;
- manuel ;
- fermeture propre ;
- pré-migration ;
- pré-restauration.

Un snapshot automatique n’est envisagé qu’après 15 minutes et uniquement si le fingerprint significatif a changé. Les écritures Phase 11 purement opérationnelles (audit/timestamps de récupération) ne font pas varier ce fingerprint.

Rétention :

- 20 snapshots automatiques/fermeture ;
- 10 snapshots manuels ;
- snapshots migration et pré-restauration jamais supprimés automatiquement.

## Restauration transactionnelle et sécurité

Avant toute restauration :

1. validation du manifeste de backup ;
2. vérification de la taille et du SHA-256 de chaque fichier ;
3. `integrity_check` de la SQLite sauvegardée ;
4. création obligatoire d’un snapshot `pre_restore` de l’état courant ;
5. quiescence des coordinators Phase 9/10 et fermeture des repositories ;
6. retrait du projet de la liste des projets ouverts afin que le timer automatique ne puisse pas démarrer un snapshot pendant le swap.

La restauration :

- ne remplace jamais silencieusement un média/source ou un export immuable dont le checksum courant diffère du snapshot ;
- restaure uniquement les fichiers durables manquants ;
- stage la base dans `temp/restoring` ;
- effectue un swap avec base rollback ;
- vérifie la base restaurée ;
- remet en place le schéma Phase 11 ;
- restaure la base originale et supprime les fichiers créés si une étape échoue ;
- conserve le snapshot `pre_restore` comme filet de sécurité supplémentaire ;
- exige la réouverture du projet après succès.

## Nettoyage des temporaires

Le nettoyeur ne touche qu’aux racines recréables :

- `temp/rendering` ;
- `temp/exporting` ;
- `temp/restoring` ;
- `audio/temp`.

Les répertoires des jobs de rendu/export actifs sont exclus par identifiant exact.

Le backend refuse également le nettoyage manuel pendant une génération de narration active afin de ne jamais supprimer le WAV temporaire utilisé par Piper.

Aucun média source ni export final n’est une cible de nettoyage.

## Tableau des tâches, historique et obsolescence

`ProjectTaskBoard` agrège les historiques Phase 9 et Phase 10 :

- rendus Remotion ;
- exports finaux FFmpeg.

Pour chaque tâche : type, statut, progression, tentative, diagnostic, timestamps, état actif et obsolescence par comparaison de la version projet source.

Les sorties historiques ne sont pas supprimées lorsqu’elles deviennent obsolètes ; elles restent traçables.

## IPC / preload / renderer

Nouveaux canaux typés :

- `reliability:overview` ;
- `reliability:run-audit` ;
- `reliability:create-backup` ;
- `reliability:restore-backup` ;
- `reliability:clean-temp`.

Le renderer n’accède jamais directement à Node, SQLite ou au filesystem.

Un panneau **Fiabilité & récupération** est intégré à l’éditeur avec :

- statut de santé ;
- checklist ;
- anomalies ;
- création de point de récupération ;
- restauration avec confirmation explicite ;
- nettoyage de temporaires ;
- historique des tâches et indication d’obsolescence ;
- message spécifique lorsqu’une fermeture brutale précédente a été détectée.

Les actions destructrices sont désactivées lorsqu’un rendu/export est actif et le backend conserve les gardes de sécurité indépendamment de l’UI.

## Fermeture de l’application

Le chemin `before-quit` Phase 11 :

1. stoppe le timer de snapshots ;
2. arrête proprement export final et rendu ;
3. crée si nécessaire le snapshot de fermeture des projets ouverts ;
4. marque les sessions propres ;
5. dispose Remotion ;
6. arrête le watcher média ;
7. libère les locks ;
8. ferme tous les repositories SQLite ;
9. appelle ensuite `app.quit()`.

## Couverture ajoutée

Tests Phase 11 ajoutés pour :

- manifeste/version ancienne/nouvelle ;
- repository d’audit/migration ;
- audit structuré ;
- média absent ;
- export final modifié ;
- crash et temporaires ;
- création/validation/corruption de snapshot ;
- exclusion des fichiers temporaires/dérivés/opérationnels du snapshot ;
- fingerprint significatif ;
- marqueur de session ;
- nettoyage sûr ;
- tableau tâches/obsolescence ;
- migration avec backup préalable ;
- snapshot automatique sans churn Phase 11 ;
- restauration SQLite avec snapshot de sécurité ;
- UI de fiabilité/restauration.

Comptage statique de la source candidate :

- **68 fichiers de tests** ;
- **379 cas `it()` / `test()`** ;
- **240 fichiers TypeScript/TSX** hors `out/node_modules/.git` ;
- **0 erreur de parsing TypeScript** ;
- **0 import relatif manquant** ;
- **0 import Node/Electron/SQLite/Execa/FFmpeg interdit dans le renderer**.

La baseline Phase 10 était 59 fichiers / 342 tests. La cible Windows devient donc **68/68 fichiers et 379/379 tests minimum**.

## Contrôles restant obligatoires sur Windows

Cet environnement de construction ne possède pas le `node_modules` Windows/ABI du projet et ne permet pas de certifier les gates réels. Il ne faut donc pas assimiler les contrôles statiques ci-dessus à une certification Windows.

À exécuter sur `C:\Dev\SCPT` :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
pnpm env:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Cible :

- env:check PASS ;
- typecheck PASS ;
- lint PASS 0 warning ;
- 68/68 fichiers PASS ;
- 379/379 tests PASS minimum ;
- build PASS ;
- Electron réel PASS ;
- IPC `Phase 1 through Phase 11 reliability and recovery` ;
- 0 unhandled error.

Puis certification fonctionnelle réelle : crash/reprise, backup manuel, restauration, migration legacy, conservation d’un export final, média remplacé/manquant, nettoyage temp et audit.

## Frontière Phase 12

Aucune fonctionnalité de Phase 12 n’est implémentée : pas de Playwright Electron, onboarding, thème premium, installateur, accessibilité finale ou travail de release candidate dans ce patch.

## Verdict d’implémentation

Le périmètre Phase 11 canonique est implémenté de façon local-first et sans nouvelle dépendance. Le patch est prêt pour les gates Windows et la certification fonctionnelle finale ; la phase ne doit être figée qu’après ces preuves réelles.
