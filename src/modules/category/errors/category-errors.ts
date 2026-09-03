import { DomainError } from '@/shared/errors/domain-error'

export class CategoryNotFoundError extends DomainError {
  constructor(message: string = 'errors.category_not_found') {
    super(message, 'NOT_FOUND')
    this.name = 'CategoryNotFoundError'
    Object.setPrototypeOf(this, CategoryNotFoundError.prototype)
  }
}

export class CategoryAlreadyExistsError extends DomainError {
  constructor(message: string = 'errors.category_already_exists') {
    super(message, 'CONFLICT')
    this.name = 'CategoryAlreadyExistsError'
    Object.setPrototypeOf(this, CategoryAlreadyExistsError.prototype)
  }
}
