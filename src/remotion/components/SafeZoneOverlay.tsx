import type { PreviewSafeZone } from '../types/preview-types'

export function SafeZoneOverlay({ safeZone }: { safeZone: PreviewSafeZone }): JSX.Element {
  return (
    <div
      data-testid="safe-zone-overlay"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: safeZone.left,
        right: safeZone.right,
        top: safeZone.top,
        bottom: safeZone.bottom,
        border: '2px dashed rgba(255,255,255,0.46)',
        borderRadius: 12,
        zIndex: 200,
        pointerEvents: 'none',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset'
      }}
    />
  )
}
