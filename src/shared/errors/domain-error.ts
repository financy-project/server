export type DomainErrorCode =
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INTERNAL_SERVER_ERROR'

export class DomainError extends Error {
  private readonly _code: DomainErrorCode

  constructor(message: string, code: DomainErrorCode = 'BAD_USER_INPUT') {
    super(message)
    this.name = 'DomainError'
    this._code = code
    Object.setPrototypeOf(this, DomainError.prototype)
  }

  get code(): DomainErrorCode {
    return this._code
  }
}
