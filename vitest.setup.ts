import '@testing-library/jest-dom/vitest'

// Phase 5 preflight: Recharts ResponsiveContainer needs ResizeObserver in jsdom
class ResizeObserverMock {
  observe() { }
  unobserve() { }
  disconnect() { }
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
