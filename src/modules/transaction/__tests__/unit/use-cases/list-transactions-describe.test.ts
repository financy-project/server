import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'

jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    findAllByUserId: jest.fn(),
  },
}))
jest.mock('@/shared/utils/date-range', () => ({
  getCurrentMonthRange: jest.fn(),
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { getCurrentMonthRange } from '@/shared/utils/date-range'
import { ListTransactionsUseCase } from '../../../use-cases/list-transactions.use-case'

const items = [
  Transaction.fromRepository({
    id: 'txn-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    type: TransactionKind.EXPENSE,
    description: 'Groceries',
    date: new Date('2026-09-01T00:00:00.000Z'),
    value: 5000,
  }),
]

describe('ListTransactionsUseCase.listTransactions()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(TransactionRepository.findAllByUserId as jest.Mock).mockResolvedValue({
      items,
      hasNextPage: false,
      endCursor: null,
    })
  })

  it('T-016: defaults to getCurrentMonthRange() when no dates are given', async () => {
    const monthRange = {
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
    }
    ;(getCurrentMonthRange as jest.Mock).mockReturnValue(monthRange)

    const result = await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate: null,
      endDate: null,
      first: 20,
      after: null,
    })

    expect(getCurrentMonthRange).toHaveBeenCalled()
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      monthRange,
      { first: 20, after: null },
    )
    expect(result.items).toBe(items)
  })

  it('T-016: passes explicit dates through unchanged when given', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-01-31T23:59:59.999Z')

    await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate,
      endDate,
      first: 10,
      after: 'cursor-1',
    })

    expect(getCurrentMonthRange).not.toHaveBeenCalled()
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      { startDate, endDate },
      { first: 10, after: 'cursor-1' },
    )
  })
})
