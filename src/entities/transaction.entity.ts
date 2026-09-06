import { generateUUID } from '@/shared/utils/uuid'
import { DomainError } from '@/shared/errors'

export enum TransactionKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

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

export type TransactionProps = {
  id: string
  userId: string
  categoryId: string | null
  type: TransactionKind
  description: string
  date: Date
  value: number
}

export type CreateTransactionProps = Omit<
  TransactionProps,
  'id' | 'categoryId'
> & {
  categoryId: string
}

export type UpdateTransactionPatch = Partial<
  Pick<
    TransactionProps,
    'categoryId' | 'type' | 'description' | 'date' | 'value'
  >
>

export class Transaction {
  readonly id: string
  readonly userId: string
  readonly categoryId: string | null
  readonly type: TransactionKind
  readonly description: string
  readonly date: Date
  readonly value: number

  private constructor(props: TransactionProps) {
    this.id = props.id
    this.userId = props.userId
    this.categoryId = props.categoryId
    this.type = props.type
    this.description = props.description
    this.date = props.date
    this.value = props.value
  }

  static create(props: CreateTransactionProps): Transaction {
    return new Transaction({ id: generateUUID(), ...props })
  }

  static fromRepository(props: TransactionProps): Transaction {
    return new Transaction(props)
  }

  belongsTo(userId: string): boolean {
    return this.userId === userId
  }
}
