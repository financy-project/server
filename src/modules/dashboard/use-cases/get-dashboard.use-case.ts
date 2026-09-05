import { TransactionKind, TransactionRepository } from '@/modules/transaction'
import { CategoryRepository } from '@/modules/category'
import { getCurrentMonthRange } from '@/shared/utils/date-range'
import type {
  CategoryBalance,
  DashboardMovement,
  DashboardSummary,
} from '../types/dashboard.types'

const getDashboard = async (userId: string): Promise<DashboardSummary> => {
  const { startDate, endDate } = getCurrentMonthRange()
  const rows = await TransactionRepository.summarizeForUser(userId, {
    startDate,
    endDate,
  })

  const movement: DashboardMovement = { income: 0, expense: 0, totalBalance: 0 }
  const categoryAggregates = new Map<
    string,
    { transactionCount: number; totalValue: number }
  >()

  for (const row of rows) {
    if (row.type === TransactionKind.INCOME) {
      movement.income += row.totalValue
    } else {
      movement.expense += row.totalValue
    }

    if (row.categoryId === null) continue

    const aggregate = categoryAggregates.get(row.categoryId) ?? {
      transactionCount: 0,
      totalValue: 0,
    }
    aggregate.transactionCount += row.count
    aggregate.totalValue +=
      row.type === TransactionKind.INCOME ? row.totalValue : -row.totalValue
    categoryAggregates.set(row.categoryId, aggregate)
  }
  movement.totalBalance = movement.income - movement.expense

  const categoryIds = Array.from(categoryAggregates.keys())
  const categories = await CategoryRepository.findManyByIds(categoryIds)
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )

  const balanceByCategory: CategoryBalance[] = categoryIds.map((categoryId) => {
    const category = categoryById.get(categoryId)!
    const aggregate = categoryAggregates.get(categoryId)!
    return {
      categoryId,
      title: category.title,
      color: category.color,
      transactionCount: aggregate.transactionCount,
      totalValue: aggregate.totalValue,
    }
  })

  const { items: recentTransactions } =
    await TransactionRepository.findAllByUserId(
      userId,
      {
        startDate: null,
        endDate: null,
        description: null,
        type: null,
        categoryIds: null,
      },
      { first: 5, after: null },
    )

  return { movement, recentTransactions, balanceByCategory }
}

export const GetDashboardUseCase = {
  getDashboard,
}
