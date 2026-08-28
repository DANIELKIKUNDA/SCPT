import { SceneId } from '../value-objects/scene-id'
import { type SceneType, validateSceneType } from '../value-objects/scene-type'
import { ProjetAudiovisuelId } from '../value-objects/projet-audiovisuel-id'
import { VersionMetier } from '../value-objects/version-metier'

/**
 * Minimal CompositionScene for Phase 3.
 * No Remotion dependency — just a data structure for layout/positioning.
 * Expanded in Phase 5 when @remotion/player is integrated.
 */
export interface CompositionScene {
  /** CSS-style background color */
  backgroundColor: string
  /** Layout mode */
  layout: 'centered' | 'top' | 'split-left' | 'split-right'
}

/**
 * Minimal TransitionScene for Phase 3.
 * Describes the transition effect between this scene and the next.
 */
export interface TransitionScene {
  type: 'fade' | 'slide-left' | 'slide-right' | 'none'
  durationMs: number
}

export interface SceneProps {
  id: SceneId
  projetId: ProjetAudiovisuelId
  ordre: number
  type: SceneType
  titre: string | null
  narrationTexte: string | null
  texteAffiche: string | null
  dureeMs: number
  composition: CompositionScene
  transition: TransitionScene
  version: VersionMetier
}

const DEFAULT_COMPOSITION: CompositionScene = {
  backgroundColor: '#1e1e2e',
  layout: 'centered'
}

const DEFAULT_TRANSITION: TransitionScene = {
  type: 'fade',
  durationMs: 300
}

function validateComposition(composition: CompositionScene): CompositionScene {
  if (!composition.backgroundColor.trim()) {
    throw new Error('Scene backgroundColor is required')
  }
  if (!['centered', 'top', 'split-left', 'split-right'].includes(composition.layout)) {
    throw new Error(`Invalid scene layout: ${composition.layout}`)
  }
  return { ...composition }
}

function validateTransition(transition: TransitionScene): TransitionScene {
  if (!['fade', 'slide-left', 'slide-right', 'none'].includes(transition.type)) {
    throw new Error(`Invalid scene transition: ${transition.type}`)
  }
  if (!Number.isFinite(transition.durationMs) || transition.durationMs < 0) {
    throw new Error('Scene transition duration must be >= 0')
  }
  return { ...transition }
}

export class Scene {
  private constructor(private readonly props: SceneProps) {}

  static create(params: {
    id?: SceneId
    projetId: ProjetAudiovisuelId
    ordre: number
    type: SceneType
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
    composition?: CompositionScene
    transition?: TransitionScene
  }): Scene {
    if (params.ordre < 1) {
      throw new Error('Scene order must be >= 1')
    }
    if (params.dureeMs !== undefined && params.dureeMs <= 0) {
      throw new Error('Scene duration must be positive')
    }
    return new Scene({
      id: params.id ?? SceneId.generate(),
      projetId: params.projetId,
      ordre: params.ordre,
      type: validateSceneType(params.type),
      titre: params.titre ?? null,
      narrationTexte: params.narrationTexte ?? null,
      texteAffiche: params.texteAffiche ?? null,
      dureeMs: params.dureeMs ?? 5000,
      composition: validateComposition(params.composition ?? DEFAULT_COMPOSITION),
      transition: validateTransition(params.transition ?? DEFAULT_TRANSITION),
      version: VersionMetier.initial()
    })
  }

  /** Reconstruct from persistence (skips validation for already-validated data) */
  static fromPersistence(props: SceneProps): Scene {
    return new Scene(props)
  }

  get id(): SceneId { return this.props.id }
  get projetId(): ProjetAudiovisuelId { return this.props.projetId }
  get ordre(): number { return this.props.ordre }
  get type(): SceneType { return this.props.type }
  get titre(): string | null { return this.props.titre }
  get narrationTexte(): string | null { return this.props.narrationTexte }
  get texteAffiche(): string | null { return this.props.texteAffiche }
  get dureeMs(): number { return this.props.dureeMs }
  get composition(): CompositionScene { return this.props.composition }
  get transition(): TransitionScene { return this.props.transition }
  get version(): VersionMetier { return this.props.version }

  /** Returns a serializable snapshot for IPC */
  toJSON(): SceneProps {
    return { ...this.props }
  }

  /** Change the order (called by repository during reorder) */
  withOrdre(newOrdre: number): Scene {
    if (newOrdre < 1) throw new Error('Scene order must be >= 1')
    return new Scene({ ...this.props, ordre: newOrdre })
  }

  /** Update editable fields */
  update(params: {
    titre?: string | null
    narrationTexte?: string | null
    texteAffiche?: string | null
    dureeMs?: number
    composition?: CompositionScene
    transition?: TransitionScene
  }): Scene {
    if (params.dureeMs !== undefined && params.dureeMs <= 0) {
      throw new Error('Scene duration must be positive')
    }
    return new Scene({
      ...this.props,
      titre: params.titre !== undefined ? params.titre : this.props.titre,
      narrationTexte: params.narrationTexte !== undefined ? params.narrationTexte : this.props.narrationTexte,
      texteAffiche: params.texteAffiche !== undefined ? params.texteAffiche : this.props.texteAffiche,
      dureeMs: params.dureeMs !== undefined ? params.dureeMs : this.props.dureeMs,
      composition: validateComposition(params.composition ?? this.props.composition),
      transition: validateTransition(params.transition ?? this.props.transition),
      version: this.props.version.next()
    })
  }
}