import {
  Transaction,
  type CreateTransactionProps,
} from '../entity/transaction.entity'
import { TransactionCategoryNotFoundError } from '../errors/transaction-errors'
import { TransactionRepository } from '../repository/transaction.repository'
import { findCategoriesByIds } from '../gateways/find-categories-by-ids.gateway'

const createTransaction = async (
  input: CreateTransactionProps,
): Promise<Transaction> => {
  const [category] = await findCategoriesByIds([input.categoryId])

  if (!category || category.userId !== input.userId) {
    throw new TransactionCategoryNotFoundError()
  }

  const transaction = Transaction.create(input)
  return TransactionRepository.create(transaction)
}

export const CreateTransactionUseCase = {
  createTransaction,
}
