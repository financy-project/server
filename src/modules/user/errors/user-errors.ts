import { DomainError } from '@/shared/errors/domain-error'

export class UserAlreadyExistsError extends DomainError {
  constructor(message: string = 'errors.user_already_exists') {
    super(message, 'CONFLICT')
    this.name = 'UserAlreadyExistsError'
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)
  }
}
