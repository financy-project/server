import { DomainError } from '@/shared/errors/domain-error'

export class InvalidCredentialsError extends DomainError {
  constructor(message: string = 'errors.invalid_credentials') {
    super(message, 'UNAUTHENTICATED')
    this.name = 'InvalidCredentialsError'
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype)
  }
}
