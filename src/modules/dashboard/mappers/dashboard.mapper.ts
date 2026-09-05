import type { Transaction } from '@/modules/transaction'
import { TransactionType } from '@/modules/transaction/graphql/object-types/transaction.object-type'
import type { DashboardSummary } from '../types/dashboard.types'
import { DashboardMovementType } from '../graphql/object-types/dashboard-movement.object-type'
import { DashboardCategoryBalanceType } from '../graphql/object-types/dashboard-category-balance.object-type'
import { DashboardType } from '../graphql/object-types/dashboard.object-type'

// Re-implemented locally rather than imported from the transaction module's
// own mapper (mappers are never part of a module's public barrel) — same
// precedent as auth.mapper.ts's toAuthenticatedUserType. Sets categoryId so
// TransactionResolver's existing `category` @FieldResolver (bound to
// TransactionType itself, not to any specific query) has something to key
// its DataLoader on.
const toRecentTransactionType = (transaction: Transaction): TransactionType => {
  const type = new TransactionType()
  type.id = transaction.id
  type.type = transaction.type
  type.description = transaction.description
  type.date = transaction.date
  type.value = transaction.value
  type.categoryId = transaction.categoryId
  return type
}

export const toDashboardType = (summary: DashboardSummary): DashboardType => {
  const dashboard = new DashboardType()

  const movement = new DashboardMovementType()
  movement.income = summary.movement.income
  movement.expense = summary.movement.expense
  movement.totalBalance = summary.movement.totalBalance
  dashboard.movement = movement

  dashboard.recentTransactions = summary.recentTransactions.map(
    toRecentTransactionType,
  )

  dashboard.balanceByCategory = summary.balanceByCategory.map((balance) => {
    const categoryBalance = new DashboardCategoryBalanceType()
    categoryBalance.categoryId = balance.categoryId
    categoryBalance.title = balance.title
    categoryBalance.color = balance.color
    categoryBalance.transactionCount = balance.transactionCount
    categoryBalance.totalValue = balance.totalValue
    return categoryBalance
  })

  return dashboard
}
