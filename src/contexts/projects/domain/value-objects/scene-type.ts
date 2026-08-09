export const SCENE_TYPES = [
  'texte',
  'formule',
  'image',
  'code'
] as const

export type SceneType = (typeof SCENE_TYPES)[number]

export function isSceneType(value: unknown): value is SceneType {
  return typeof value === 'string' && SCENE_TYPES.includes(value as SceneType)
}

export function validateSceneType(value: string): SceneType {
  if (!isSceneType(value)) {
    throw new Error(`Invalid SceneType: ${value}. Valid types: ${SCENE_TYPES.join(', ')}`)
  }
  return value
}