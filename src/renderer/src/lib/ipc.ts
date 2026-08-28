import type { IpcResult } from '../../../shared/types/ipc'

export function unwrapIpc<T>(result: IpcResult<T>): T {
  if (result.ok) return result.data
  throw new Error(result.error.message)
}
