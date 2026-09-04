import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'

jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    findAllByUserId: jest.fn(),
  },
}))
jest.mock('@/shared/utils/date-range', () => ({
  getCurrentMonthRange: jest.fn(),
  getMonthRange: jest.fn(),
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { getMonthRange } from '@/shared/utils/date-range'
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

  it('resolves month+year via getMonthRange() and forwards its exact range', async () => {
    const monthRange = {
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
    }
    ;(getMonthRange as jest.Mock).mockReturnValue(monthRange)

    const result = await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate: null,
      endDate: null,
      month: 9,
      year: 2026,
      description: null,
      type: null,
      categoryIds: null,
      first: 20,
      after: null,
    })

    expect(getMonthRange).toHaveBeenCalledWith(2026, 9)
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
        description: null,
        type: null,
        categoryIds: null,
      },
      { first: 20, after: null },
    )
    expect(result.items).toBe(items)
  })

  it('passes explicit startDate/endDate through unchanged when given (no month/year)', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-01-31T23:59:59.999Z')

    await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate,
      endDate,
      month: null,
      year: null,
      description: null,
      type: null,
      categoryIds: null,
      first: 10,
      after: 'cursor-1',
    })

    expect(getMonthRange).not.toHaveBeenCalled()
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        startDate,
        endDate,
        description: null,
        type: null,
        categoryIds: null,
      },
      { first: 10, after: 'cursor-1' },
    )
  })

  it('calls the repository with null startDate/endDate when neither month/year nor startDate/endDate are given', async () => {
    await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate: null,
      endDate: null,
      month: null,
      year: null,
      description: null,
      type: null,
      categoryIds: null,
      first: 20,
      after: null,
    })

    expect(getMonthRange).not.toHaveBeenCalled()
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        startDate: null,
        endDate: null,
        description: null,
        type: null,
        categoryIds: null,
      },
      { first: 20, after: null },
    )
  })

  it('forwards description/type/categoryIds to the repository unchanged', async () => {
    await ListTransactionsUseCase.listTransactions({
      userId: 'user-1',
      startDate: null,
      endDate: null,
      month: null,
      year: null,
      description: 'mercado',
      type: TransactionKind.EXPENSE,
      categoryIds: ['cat-1', 'cat-2'],
      first: 20,
      after: null,
    })

    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        startDate: null,
        endDate: null,
        description: 'mercado',
        type: TransactionKind.EXPENSE,
        categoryIds: ['cat-1', 'cat-2'],
      },
      { first: 20, after: null },
    )
  })
})
