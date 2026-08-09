export const MEDIA_TYPES = ['image', 'video', 'audio', 'musique', 'logo', 'document'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && MEDIA_TYPES.includes(value as MediaType)
}

export function validateMediaType(value: string): MediaType {
  if (!isMediaType(value)) {
    throw new Error(`Invalid MediaType: ${value}. Valid types: ${MEDIA_TYPES.join(', ')}`)
  }
  return value
}