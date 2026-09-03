import {
  Transaction,
  type UpdateTransactionPatch,
} from '../entity/transaction.entity'
import {
  TransactionCategoryNotFoundError,
  TransactionNotFoundError,
} from '../errors/transaction-errors'
import { TransactionRepository } from '../repository/transaction.repository'
import { findCategoriesByIds } from '../gateways/find-categories-by-ids.gateway'

type UpdateTransactionInput = {
  id: string
  userId: string
  patch: UpdateTransactionPatch
}

const updateTransaction = async (
  input: UpdateTransactionInput,
): Promise<Transaction> => {
  const { id, userId, patch } = input
  const transaction = await TransactionRepository.findById(id)

  if (!transaction.belongsTo(userId)) {
    throw new TransactionNotFoundError()
  }

  if (patch.categoryId !== undefined && patch.categoryId !== null) {
    const [category] = await findCategoriesByIds([patch.categoryId])

    if (!category || category.userId !== userId) {
      throw new TransactionCategoryNotFoundError()
    }
  }

  return TransactionRepository.update(id, patch)
}

export const UpdateTransactionUseCase = {
  updateTransaction,
}
