import { DomainError } from './domain-error'

export class ValidationError extends DomainError {
  readonly metadata?: Record<string, unknown>

  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'BAD_USER_INPUT')
    this.name = 'ValidationError'
    if (metadata) {
      this.metadata = metadata
    }
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}
