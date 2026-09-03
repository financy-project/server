import { DomainError } from '@/shared/errors/domain-error'

export class UnauthenticatedError extends DomainError {
  constructor(message: string = 'errors.unauthenticated') {
    super(message, 'UNAUTHENTICATED')
    this.name = 'UnauthenticatedError'
    Object.setPrototypeOf(this, UnauthenticatedError.prototype)
  }
}
