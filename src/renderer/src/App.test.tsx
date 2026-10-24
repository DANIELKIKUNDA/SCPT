import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App — Phase 12 premium shell', () => {
  it('affiche l’identité SCPT', () => {
    render(<App />)
    expect(screen.getByText('SCPT')).toBeDefined()
    expect(screen.getByText('Studio de Création Pédagogique et Technique')).toBeDefined()
  })

  it('présente la proposition de valeur du studio', () => {
    render(<App />)
    expect(screen.getByText(/Transformez vos idées en/)).toBeDefined()
    expect(screen.getByText(/Studio audiovisuel local-first/)).toBeDefined()
  })

  it('expose les actions principales', () => {
    render(<App />)
    expect(screen.getAllByText('Nouveau projet').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Reprendre un projet')).toBeDefined()
  })

  it('affiche les préférences de confort', () => {
    render(<App />)
    expect(screen.getByText('Préférences')).toBeDefined()
    expect(screen.getByText('Apparence')).toBeDefined()
    expect(screen.getByText('Réduire les animations')).toBeDefined()
  })
})
