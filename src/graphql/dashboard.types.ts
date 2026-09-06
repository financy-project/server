import { Field, ID, Int, ObjectType } from 'type-graphql'
import type { Transaction } from '@/entities/transaction.entity'
import { TransactionType, toTransactionType } from './transaction.types'

@ObjectType()
export class DashboardMovementType {
  @Field(() => Int)
  income!: number

  @Field(() => Int)
  expense!: number

  @Field(() => Int)
  totalBalance!: number
}

@ObjectType()
export class DashboardCategoryBalanceType {
  @Field(() => ID)
  categoryId!: string

  @Field()
  title!: string

  @Field()
  color!: string

  @Field(() => Int)
  transactionCount!: number

  @Field(() => Int)
  totalValue!: number
}

@ObjectType()
export class DashboardType {
  @Field(() => DashboardMovementType)
  movement!: DashboardMovementType

  @Field(() => [TransactionType], { complexity: 3 })
  recentTransactions!: TransactionType[]

  @Field(() => [DashboardCategoryBalanceType], { complexity: 5 })
  balanceByCategory!: DashboardCategoryBalanceType[]
}

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

export const toDashboardType = (summary: DashboardSummary): DashboardType => {
  const dashboard = new DashboardType()

  const movement = new DashboardMovementType()
  movement.income = summary.movement.income
  movement.expense = summary.movement.expense
  movement.totalBalance = summary.movement.totalBalance
  dashboard.movement = movement

  dashboard.recentTransactions =
    summary.recentTransactions.map(toTransactionType)

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
