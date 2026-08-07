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

  it('affiche le statut React et Electron fonctionnel', () => {
    render(<App />)
    expect(screen.getByText('React')).toBeDefined()
    const fonctionnelElements = screen.getAllByText('fonctionnel')
    expect(fonctionnelElements.length).toBeGreaterThanOrEqual(2)
  })

  it('affiche le statut Electron', () => {
    render(<App />)
    const electronElements = screen.getAllByText('fonctionnel')
    expect(electronElements.length).toBeGreaterThanOrEqual(2)
  })
})