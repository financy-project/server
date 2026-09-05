jest.mock('@/modules/transaction', () => {
  const actual = jest.requireActual('@/modules/transaction')
  return {
    ...actual,
    TransactionRepository: {
      summarizeForUser: jest.fn(),
      findAllByUserId: jest.fn(),
    },
  }
})
jest.mock('@/modules/category', () => {
  const actual = jest.requireActual('@/modules/category')
  return {
    ...actual,
    CategoryRepository: {
      findManyByIds: jest.fn(),
    },
  }
})
jest.mock('@/shared/utils/date-range', () => ({
  getCurrentMonthRange: jest.fn(),
}))

import {
  Transaction,
  TransactionKind,
  TransactionRepository,
} from '@/modules/transaction'
import { Category, CategoryRepository } from '@/modules/category'
import { getCurrentMonthRange } from '@/shared/utils/date-range'
import { GetDashboardUseCase } from '../../../use-cases/get-dashboard.use-case'

const monthRange = {
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2026-09-30T23:59:59.999Z'),
}

const emptyRecentTransactions = {
  items: [],
  hasNextPage: false,
  endCursor: null,
  totalRecord: 0,
}

describe('GetDashboardUseCase.getDashboard()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getCurrentMonthRange as jest.Mock).mockReturnValue(monthRange)
    ;(TransactionRepository.summarizeForUser as jest.Mock).mockResolvedValue([])
    ;(TransactionRepository.findAllByUserId as jest.Mock).mockResolvedValue(
      emptyRecentTransactions,
    )
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([])
  })

  it('T-006: computes movement.income/expense/totalBalance from mixed INCOME/EXPENSE summary rows', async () => {
    ;(TransactionRepository.summarizeForUser as jest.Mock).mockResolvedValue([
      {
        categoryId: 'cat-1',
        type: TransactionKind.INCOME,
        totalValue: 5000,
        count: 2,
      },
      {
        categoryId: 'cat-2',
        type: TransactionKind.EXPENSE,
        totalValue: 2000,
        count: 1,
      },
    ])
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([
      Category.fromRepository({
        id: 'cat-1',
        userId: 'user-1',
        title: 'Salary',
        description: null,
        icon: 'briefcase',
        color: '#00ff00',
      }),
      Category.fromRepository({
        id: 'cat-2',
        userId: 'user-1',
        title: 'Rent',
        description: null,
        icon: 'home',
        color: '#ff0000',
      }),
    ])

    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.movement).toEqual({
      income: 5000,
      expense: 2000,
      totalBalance: 3000,
    })
    expect(getCurrentMonthRange).toHaveBeenCalled()
    expect(TransactionRepository.summarizeForUser).toHaveBeenCalledWith(
      'user-1',
      monthRange,
    )
  })

  it('T-007: returns movement all-zero when summarizeForUser returns []', async () => {
    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.movement).toEqual({
      income: 0,
      expense: 0,
      totalBalance: 0,
    })
    expect(result.balanceByCategory).toEqual([])
  })

  it('T-008: nets totalValue per category (INCOME adds, EXPENSE subtracts) and sums transactionCount across both types', async () => {
    ;(TransactionRepository.summarizeForUser as jest.Mock).mockResolvedValue([
      {
        categoryId: 'cat-1',
        type: TransactionKind.INCOME,
        totalValue: 1000,
        count: 1,
      },
      {
        categoryId: 'cat-1',
        type: TransactionKind.EXPENSE,
        totalValue: 400,
        count: 2,
      },
    ])
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([
      Category.fromRepository({
        id: 'cat-1',
        userId: 'user-1',
        title: 'Mixed',
        description: null,
        icon: 'wallet',
        color: '#123456',
      }),
    ])

    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.balanceByCategory).toEqual([
      {
        categoryId: 'cat-1',
        title: 'Mixed',
        color: '#123456',
        transactionCount: 3,
        totalValue: 600,
      },
    ])
  })

  it('T-009: excludes the categoryId: null group from balanceByCategory', async () => {
    ;(TransactionRepository.summarizeForUser as jest.Mock).mockResolvedValue([
      {
        categoryId: null,
        type: TransactionKind.EXPENSE,
        totalValue: 300,
        count: 1,
      },
    ])

    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.balanceByCategory).toEqual([])
    expect(CategoryRepository.findManyByIds).toHaveBeenCalledWith([])
  })

  it('T-010: omits categories with no rows this month (never invents a zero-value entry)', async () => {
    ;(TransactionRepository.summarizeForUser as jest.Mock).mockResolvedValue([
      {
        categoryId: 'cat-with-activity',
        type: TransactionKind.EXPENSE,
        totalValue: 100,
        count: 1,
      },
    ])
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([
      Category.fromRepository({
        id: 'cat-with-activity',
        userId: 'user-1',
        title: 'Active',
        description: null,
        icon: 'icon',
        color: '#000000',
      }),
    ])

    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.balanceByCategory).toHaveLength(1)
    expect(CategoryRepository.findManyByIds).toHaveBeenCalledWith([
      'cat-with-activity',
    ])
  })

  it("T-011: returns recentTransactions from findAllByUserId's items unmodified", async () => {
    const items = [
      Transaction.fromRepository({
        id: 'txn-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date('2026-09-05T00:00:00.000Z'),
        value: 5000,
      }),
    ]
    ;(TransactionRepository.findAllByUserId as jest.Mock).mockResolvedValue({
      items,
      hasNextPage: true,
      endCursor: 'cursor-1',
      totalRecord: 10,
    })

    const result = await GetDashboardUseCase.getDashboard('user-1')

    expect(result.recentTransactions).toBe(items)
    expect(TransactionRepository.findAllByUserId).toHaveBeenCalledWith(
      'user-1',
      {
        startDate: null,
        endDate: null,
        description: null,
        type: null,
        categoryIds: null,
      },
      { first: 5, after: null },
    )
  })
})
