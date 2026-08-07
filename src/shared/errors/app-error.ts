import type { ErrorCode } from './error-codes'

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly userMessage: string
  public readonly diagnostic: string
  public readonly cause?: unknown

  constructor(
    code: ErrorCode,
    userMessage: string,
    diagnostic: string,
    cause?: unknown
  ) {
    super(userMessage)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage
    this.diagnostic = diagnostic
    this.cause = cause
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.userMessage,
      diagnostic: this.diagnostic
    }
  }
}