import { DomainError } from '@/shared/errors/domain-error'

export class TransactionNotFoundError extends DomainError {
  constructor(message: string = 'errors.transaction_not_found') {
    super(message, 'NOT_FOUND')
    this.name = 'TransactionNotFoundError'
    Object.setPrototypeOf(this, TransactionNotFoundError.prototype)
  }
}

export class TransactionCategoryNotFoundError extends DomainError {
  constructor(message: string = 'errors.transaction_category_not_found') {
    super(message, 'NOT_FOUND')
    this.name = 'TransactionCategoryNotFoundError'
    Object.setPrototypeOf(this, TransactionCategoryNotFoundError.prototype)
  }
}
