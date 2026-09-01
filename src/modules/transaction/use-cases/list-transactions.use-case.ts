import { getCurrentMonthRange } from '@/shared/utils/date-range'
import { Transaction } from '../entity/transaction.entity'
import { TransactionRepository } from '../repository/transaction.repository'

type ListTransactionsInput = {
  userId: string
  startDate: Date | null
  endDate: Date | null
  first: number
  after: string | null
}

type ListTransactionsResult = {
  items: Transaction[]
  hasNextPage: boolean
  endCursor: string | null
}

const listTransactions = async (
  input: ListTransactionsInput,
): Promise<ListTransactionsResult> => {
  const { startDate, endDate } =
    input.startDate && input.endDate
      ? { startDate: input.startDate, endDate: input.endDate }
      : getCurrentMonthRange()

  return TransactionRepository.findAllByUserId(
    input.userId,
    { startDate, endDate },
    { first: input.first, after: input.after },
  )
}

export const ListTransactionsUseCase = {
  listTransactions,
}
