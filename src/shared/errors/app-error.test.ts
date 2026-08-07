import { describe, it, expect } from 'vitest'
import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'

describe('AppError', () => {
  it('cree une erreur avec code', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid input', 'Field X is required')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.userMessage).toBe('Invalid input')
    expect(err.diagnostic).toBe('Field X is required')
    expect(err.name).toBe('AppError')
  })

  it('supporte cause optionnelle', () => {
    const cause = new Error('root')
    const err = new AppError('INTERNAL_ERROR', 'System error', 'Database failed', cause)
    expect(err.cause).toBe(cause)
  })

  it('toJSON retourne les champs cles', () => {
    const err = new AppError('IPC_ERROR', 'Communication failed', 'Timeout on channel X')
    const json = err.toJSON()
    expect(json.code).toBe('IPC_ERROR')
    expect(json.message).toBe('Communication failed')
    expect(json.diagnostic).toBe('Timeout on channel X')
  })

  it('utilise les ErrorCodes importes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.IPC_ERROR).toBe('IPC_ERROR')
    expect(ErrorCodes.PREFERENCE_ERROR).toBe('PREFERENCE_ERROR')
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
  })
})