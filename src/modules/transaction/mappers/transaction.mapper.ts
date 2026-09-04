import type {
  Transaction,
  UpdateTransactionPatch,
} from '../entity/transaction.entity'
import type { CategoryDTO } from '../ports'
import { TransactionType } from '../graphql/object-types/transaction.object-type'
import { TransactionCategoryType } from '../graphql/object-types/transaction-category.object-type'
import type { UpdateTransactionInput } from '../graphql/input-types/update-transaction.input'

export const toTransactionType = (
  transaction: Transaction,
): TransactionType => {
  const type = new TransactionType()
  type.id = transaction.id
  type.type = transaction.type
  type.description = transaction.description
  type.date = transaction.date
  type.value = transaction.value
  type.categoryId = transaction.categoryId
  return type
}

export const toTransactionCategoryType = (
  category: CategoryDTO,
): TransactionCategoryType => {
  const type = new TransactionCategoryType()
  type.id = category.id
  type.title = category.title
  type.description = category.description
  type.icon = category.icon
  type.color = category.color
  return type
}

export const toUpdateTransactionPatch = (
  input: UpdateTransactionInput,
): UpdateTransactionPatch => {
  const patch: UpdateTransactionPatch = {}
  if (input.type !== undefined) patch.type = input.type
  if (input.description !== undefined) patch.description = input.description
  if (input.date !== undefined) patch.date = input.date
  if (input.value !== undefined) patch.value = input.value
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  return patch
}
