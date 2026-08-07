# 02 — Modèle métier canonique du MVP

## 1. Règle

Le MVP utilise un modèle réduit. Les concepts futurs ne doivent pas être implémentés avant leur phase.

## 2. Agrégat `ProjetAudiovisuel`

Responsabilités :

- identité ;
- titre ;
- type ;
- objectif ;
- public ;
- langue source ;
- statut ;
- ordre des scènes ;
- références vers déclinaisons ;
- version.

Statuts :

```text
BROUILLON
EN_CONCEPTION
EN_PRODUCTION
EN_REVISION
CORRECTIONS_REQUISES
VALIDE
PRET_POUR_RENDU
RENDU
ARCHIVE
```

`PUBLIE` est réservé à une phase ultérieure, car la publication automatique est hors MVP.

## 3. Entité `Scene`

Attributs minimaux :

```yaml
id: SceneId
projetId: ProjetAudiovisuelId
ordre: number
type: texte | formule | image | video | code | diagramme | capture | mixte
titre: string | null
narrationTexte: string | null
texteAffiche: string | null
dureeMs: number
composition: CompositionScene
transition: TransitionScene
version: VersionMetier
```

Invariants :

- ordre unique ;
- durée positive ;
- type défini ;
- aucun média final manquant ;
- texte affiché distinct de la narration ;
- modification d’une scène validée = nouvelle version.

## 4. Entité `RessourceMedia`

```yaml
id: RessourceMediaId
type: image | video | audio | musique | logo | document
cheminRelatif: string
nomOriginal: string
checksum: string
tailleOctets: number
mimeType: string
dureeMs: number | null
largeur: number | null
hauteur: number | null
statut: disponible | manquante | corrompue
droits: originale | autorisee | libre | inconnue | interdite
version: VersionMetier
```

Invariants :

- la source n’est pas écrasée ;
- chemin relatif au projet ;
- droit inconnu ou interdit bloque l’export final ;
- une dérivation référence sa source.

## 5. Agrégat `PisteNarration`

```yaml
id: PisteNarrationId
projetId: ProjetAudiovisuelId
langue: string
segments: SegmentNarration[]
priseFinaleId: string | null
statut: brouillon | generee | validee | obsolete
versionTexte: VersionMetier
```

Un segment contient :

- texte ;
- scène ;
- fichier audio ;
- durée ;
- ordre ;
- statut.

## 6. Agrégat `PisteSousTitres`

```yaml
id: PisteSousTitresId
declinaisonId: DeclinaisonId
langue: string
segments: SegmentSousTitre[]
statut: brouillon | a_resynchroniser | validee | obsolete
versionNarration: VersionMetier
```

Un segment contient :

- début ;
- fin ;
- texte ;
- position ;
- style facultatif.

## 7. Agrégat `DeclinaisonAudiovisuelle`

Une déclinaison représente :

```text
projet + format + langue + objectif de sortie
```

Attributs :

```yaml
id: DeclinaisonId
projetId: ProjetAudiovisuelId
format: HORIZONTAL_16_9 | VERTICAL_9_16 | CARRE_1_1
resolution: ResolutionVideo
langue: string
profilExport: ProfilExport
statut: brouillon | adaptation_en_cours | en_revision | valide | obsolete | pret_pour_rendu
versionProjetSource: VersionMetier
version: VersionMetier
```

## 8. Agrégat `ExportAudiovisuel`

```yaml
id: ExportId
declinaisonId: DeclinaisonId
tentative: number
statut: demande | en_attente | en_preparation | en_composition | en_encodage | en_verification | termine | echoue | annule
progression: number
cheminFichier: string | null
checksum: string | null
diagnostic: string | null
profil: ProfilExport
versionsSources: EmpreinteDependances
```

## 9. Value objects obligatoires

- `ProjetAudiovisuelId`
- `SceneId`
- `RessourceMediaId`
- `PisteNarrationId`
- `PisteSousTitresId`
- `DeclinaisonId`
- `ExportId`
- `Duree`
- `Langue`
- `FormatVideo`
- `ResolutionVideo`
- `VersionMetier`
- `CheminRelatifProjet`
- `ChecksumMedia`
- `ProfilExport`
- `StatutProjet`

## 10. Événements nécessaires au MVP

- `ProjetAudiovisuelCree`
- `SceneAjoutee`
- `SceneReordonnee`
- `RessourceMediaImportee`
- `RessourceMediaManquanteDetectee`
- `PriseNarrationSelectionnee`
- `PisteSousTitresValidee`
- `DeclinaisonCreee`
- `DeclinaisonMarqueeObsolete`
- `RenduDemande`
- `RenduDemarre`
- `RenduEchoue`
- `RenduTermine`
- `FichierExportVerifie`
- `ProjetArchive`

## 11. Repositories

- `ProjetAudiovisuelRepository`
- `SequenceSceneRepository`
- `RessourceMediaRepository`
- `PisteNarrationRepository`
- `PisteSousTitresRepository`
- `DeclinaisonAudiovisuelleRepository`
- `ExportAudiovisuelRepository`

## 12. Ports

- `StockageProjetPort`
- `StockageFichierPort`
- `LectureMetadonneesMediaPort`
- `GenerationVoixPort`
- `MoteurRenduPort`
- `EncodageVideoPort`
- `JournalMetierPort`
- `HorlogePort`
- `GenerateurIdentifiantPort`

## 13. Règles de versionnement

- brouillon : modification dans la même version autorisée ;
- validation : version figée ;
- rendu terminé : export immuable ;
- modification après rendu : nouvelle version ;
- ancien export conservé ;
- déclinaison obsolète non utilisée comme courante.

## 14. Modèle explicitement exclu

Ne pas implémenter dans le MVP :

- organisations ;
- utilisateurs multiples ;
- rôles ;
- permissions ;
- commentaires ;
- validations par plusieurs personnes ;
- publication distante ;
- facturation ;
- synchronisation cloud ;
- événements distribués ;
- saga distante ;
- CQRS complet ;
- Event Sourcing.

## 15. Règle de simplicité

Un concept n’entre dans le code que s’il est utilisé par un parcours du MVP.
