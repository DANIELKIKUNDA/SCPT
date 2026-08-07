export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  IPC_ERROR: 'IPC_ERROR',
  PREFERENCE_ERROR: 'PREFERENCE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_CHANNEL: 'UNKNOWN_CHANNEL',
  TIMEOUT: 'TIMEOUT'
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]