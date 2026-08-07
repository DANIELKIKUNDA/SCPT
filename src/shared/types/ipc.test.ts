import { describe, it, expect } from 'vitest'
import { ipcSuccess, ipcFailure } from './ipc'
import type { IpcResult } from './ipc'

describe('ipcSuccess', () => {
  it('retourne un objet avec ok=true', () => {
    const result = ipcSuccess(42)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(42)
  })

  it('retourne un objet avec data complexe', () => {
    const result = ipcSuccess({ name: 'test', value: 1 })
    expect(result.ok).toBe(true)
    expect(result.data.name).toBe('test')
  })
})

describe('ipcFailure', () => {
  it('retourne un objet avec ok=false', () => {
    const result = ipcFailure('TEST_ERROR', 'Something went wrong')
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('TEST_ERROR')
    expect(result.error.message).toBe('Something went wrong')
  })
})

describe('IpcResult type', () => {
  it('supporte success', () => {
    const success: IpcResult<string> = { ok: true, data: 'hello' }
    expect(success.ok).toBe(true)
  })

  it('supporte failure', () => {
    const failure: IpcResult<string> = { ok: false, error: { code: 'X', message: 'msg' } }
    expect(failure.ok).toBe(false)
  })
})