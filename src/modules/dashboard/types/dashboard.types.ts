import type { Transaction } from '@/modules/transaction'

export type DashboardMovement = {
  income: number
  expense: number
  totalBalance: number
}

export type CategoryBalance = {
  categoryId: string
  title: string
  color: string
  transactionCount: number
  totalValue: number
}

export type DashboardSummary = {
  movement: DashboardMovement
  recentTransactions: Transaction[]
  balanceByCategory: CategoryBalance[]
}
