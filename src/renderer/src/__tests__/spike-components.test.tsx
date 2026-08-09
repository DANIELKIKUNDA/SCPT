/**
 * PHASE 3 PREFLIGHT — React component compatibility spike (TEMPORARY)
 * Validates: DnD Kit, react-resizable-panels, lucide-react, sonner, zustand
 * Remove after Phase 3 preflight is validated.
 */
import { describe, it, expect } from 'vitest'

describe('Phase 3 dependency spikes', () => {
  it('C. DnD Kit — @dnd-kit/core available', async () => {
    const dnd = await import('@dnd-kit/core')
    expect(dnd).not.toBeNull()
    expect(dnd).toHaveProperty('DndContext')
    expect(dnd).toHaveProperty('useDraggable')
  })

  it('D. react-resizable-panels — PanelGroup available', async () => {
    const rp = await import('react-resizable-panels')
    expect(rp).not.toBeNull()
    expect(rp).toHaveProperty('PanelGroup')
    expect(rp).toHaveProperty('Panel')
  })

  it('E. lucide-react — icons available', async () => {
    const lucide = await import('lucide-react')
    expect(lucide).not.toBeNull()
    expect(lucide).toHaveProperty('Camera')
    expect(lucide).toHaveProperty('Plus')
  })

  it('F. sonner — Toaster available', async () => {
    const sonner = await import('sonner')
    expect(sonner).not.toBeNull()
    expect(sonner).toHaveProperty('Toaster')
    expect(typeof sonner.toast).toBe('function')
  })

  it('G. zustand — store creates and updates', async () => {
    const { create } = await import('zustand')
    expect(create).not.toBeNull()
    const useStore = create<{ count: number; increment: () => void }>()((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }))
    expect(useStore.getState().count).toBe(0)
    useStore.getState().increment()
    expect(useStore.getState().count).toBe(1)
  })
})