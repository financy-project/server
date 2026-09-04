import { getMonthRange } from '@/shared/utils/date-range'
import { Transaction } from '../entity/transaction.entity'
import { TransactionRepository } from '../repository/transaction.repository'
import { TransactionKind } from '../enums/transaction-kind.enum'

type ListTransactionsInput = {
  userId: string
  startDate: Date | null
  endDate: Date | null
  month: number | null
  year: number | null
  description: string | null
  type: TransactionKind | null
  categoryIds: string[] | null
  first: number
  after: string | null
}

type ListTransactionsResult = {
  items: Transaction[]
  hasNextPage: boolean
  endCursor: string | null
  totalRecord: number
}

const listTransactions = async (
  input: ListTransactionsInput,
): Promise<ListTransactionsResult> => {
  const { startDate, endDate } =
    input.month && input.year
      ? getMonthRange(input.year, input.month)
      : { startDate: input.startDate, endDate: input.endDate }

  return TransactionRepository.findAllByUserId(
    input.userId,
    {
      startDate,
      endDate,
      description: input.description,
      type: input.type,
      categoryIds: input.categoryIds,
    },
    { first: input.first, after: input.after },
  )
}

export const ListTransactionsUseCase = {
  listTransactions,
}
