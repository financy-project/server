import { TransactionNotFoundError } from '../errors/transaction-errors'
import { TransactionRepository } from '../repository/transaction.repository'

type DeleteTransactionInput = {
  id: string
  userId: string
}

const deleteTransaction = async (
  input: DeleteTransactionInput,
): Promise<void> => {
  const { id, userId } = input
  const transaction = await TransactionRepository.findById(id)

  if (!transaction.belongsTo(userId)) {
    throw new TransactionNotFoundError()
  }

  await TransactionRepository.remove(id)
}

export const DeleteTransactionUseCase = {
  deleteTransaction,
}
