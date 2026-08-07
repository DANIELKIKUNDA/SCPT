import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('affiche le titre SCPT', () => {
    render(<App />)
    expect(screen.getByText('SCPT')).toBeDefined()
  })

  it('affiche le sous-titre', () => {
    render(<App />)
    expect(screen.getByText('Application de bureau locale')).toBeDefined()
  })

  it('affiche les labels de statut Phase 1', () => {
    render(<App />)
    expect(screen.getByText('React')).toBeDefined()
    expect(screen.getByText('Electron')).toBeDefined()
    expect(screen.getByText('IPC Ping')).toBeDefined()
    const prefElements = screen.getAllByText('Preferences')
    expect(prefElements.length).toBeGreaterThanOrEqual(1)
  })

  it('affiche la section Preferences', () => {
    render(<App />)
    expect(screen.getByText('Theme')).toBeDefined()
  })
})