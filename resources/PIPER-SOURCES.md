# SCPT — Ressources Piper (Phase 6)

## Provenance et licences

### Binaire Piper (Windows x64)

- **Logiciel** : Piper (Text-to-Speech local basé sur ONNX Runtime)
- **Dépôt officiel** : https://github.com/rhasspy/piper
- **Version / tag** : `2023.11.14-2`
- **Asset téléchargé** : `piper_windows_amd64.zip`
  - URL : https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip
- **Licence** : MIT
  - Fichier : `resources/piper/LICENSES/piper-LICENSE.md`

Le runtime Windows x64 inclut :
- `piper.exe` (exécutable principal)
- `onnxruntime.dll`, `onnxruntime_providers_shared.dll` (dépendances d'inférence ONNX)
- `espeak-ng.dll` + `espeak-ng-data/` (phonémisation)
- `piper_phonemize.dll`
- `libtashkeel_model.ort` (diacritisation arabe)

Aucun téléchargement automatique n'est prévu dans l'application : ces fichiers
sont versionnés comme ressources du dépôt et embarqués à l'installation.

### Voix française

- **Identifiant** : `fr_FR-siwis-medium`
- **Langue** : fr_FR (français, France)
- **Qualité** : medium — 22 050 Hz
- **Dataset** : SIWIS
  - URL : https://datashare.is.ed.ac.uk/handle/10283/2353
- **Licence du dataset** : CC-BY 4.0
  - Fichier : `resources/voices/fr/fr_FR-siwis-medium/LICENSE`
- **Catalogue des voix** : https://huggingface.co/rhasspy/piper-voices

Fichiers :
- `resources/voices/fr/fr_FR-siwis-medium/model.onnx`
- `resources/voices/fr/fr_FR-siwis-medium/model.onnx.json`

## Empreintes SHA-256

| Fichier | SHA-256 |
|---|---|
| `resources/piper/windows-x64/piper.exe` | `96f3da3811151580073e40bb4dd20eb0fb8115f5f5f76e2fb54282b3edfa5c1f` |
| `resources/voices/fr/fr_FR-siwis-medium/model.onnx` | `641d1ab097da2b81128c076810edb052b385decc8be3381814802a64a73baf99` |
| `resources/voices/fr/fr_FR-siwis-medium/model.onnx.json` | `39479916c2db192b5ac9764daddd0c744d83e023ad890c6976c0633ae4df8959` |

## Contrat de structure SCPT

```
resources/
├── piper/
│   ├── windows-x64/
│   │   └── piper.exe          (+ DLLs et données runtime nécessaires)
│   └── LICENSES/
│       └── piper-LICENSE.md
└── voices/
    └── fr/
        └── fr_FR-siwis-medium/
            ├── model.onnx
            ├── model.onnx.json
            └── LICENSE         (CC-BY 4.0)