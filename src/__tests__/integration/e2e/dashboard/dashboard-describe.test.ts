import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/shared/utils/uuid'
import { Category } from '@/entities/category.entity'
import { CategoryRepository } from '@/repositories/category.repository'
import { Transaction, TransactionKind } from '@/entities/transaction.entity'
import { TransactionRepository } from '@/repositories/transaction.repository'
import { buildCategoriesByIdLoader } from '@/loaders/categories-by-id.loader'
import { buildTransactionsQuantityByCategoryIdLoader } from '@/loaders/transactions-quantity-by-category-id.loader'

const DASHBOARD = `
  query Dashboard {
    dashboard {
      movement {
        income
        expense
        totalBalance
      }
      recentTransactions {
        id
        type
        description
        date
        value
        category {
          id
          title
          color
        }
      }
      balanceByCategory {
        categoryId
        title
        color
        transactionCount
        totalValue
      }
    }
  }
`

describe('dashboard query (e2e)', () => {
  useDatabase()

  let server: ApolloServer<GraphQLContext>

  beforeAll(async () => {
    server = await buildApolloServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  const now = new Date()
  const thisMonth = (day: number) =>
    new Date(now.getFullYear(), now.getMonth(), day)
  const lastMonth = (day: number) =>
    new Date(now.getFullYear(), now.getMonth() - 1, day)

  const createUser = async () => {
    const id = generateUUID()
    return prisma.user.create({
      data: { id, email: `${id}@example.com`, name: 'Test User' },
    })
  }

  const createCategory = async (userId: string, title: string) =>
    CategoryRepository.create(
      Category.create({
        userId,
        title,
        description: null,
        icon: 'icon',
        color: '#123456',
      }),
    )

  const createTransaction = async (input: {
    userId: string
    categoryId: string
    type: TransactionKind
    value: number
    date: Date
    description?: string
  }) =>
    TransactionRepository.create(
      Transaction.create({
        userId: input.userId,
        categoryId: input.categoryId,
        type: input.type,
        description: input.description ?? `Txn-${generateUUID()}`,
        date: input.date,
        value: input.value,
      }),
    )

  const buildContext = (userId: string | null): GraphQLContext => ({
    currentUser: userId ? { id: userId } : null,
    locale: 'en',
    loaders: {
      categoriesById: buildCategoriesByIdLoader(),
      transactionsQuantityByCategoryId:
        buildTransactionsQuantityByCategoryIdLoader(),
    },
    cookies: { get: jest.fn(), set: jest.fn() },
  })

  it('T-012: happy path — correct movement, top-5 recentTransactions with category, correct balanceByCategory', async () => {
    const user = await createUser()
    const salary = await createCategory(user.id, 'Salary')
    const rent = await createCategory(user.id, 'Rent')

    await createTransaction({
      userId: user.id,
      categoryId: salary.id,
      type: TransactionKind.INCOME,
      value: 500000,
      date: thisMonth(1),
      description: 'Paycheck',
    })
    await createTransaction({
      userId: user.id,
      categoryId: rent.id,
      type: TransactionKind.EXPENSE,
      value: 150000,
      date: thisMonth(5),
      description: 'Rent payment',
    })

    // 5 more transactions so recentTransactions (capped at 5) excludes the
    // oldest of these newest-dated ones.
    for (let day = 10; day <= 14; day += 1) {
      await createTransaction({
        userId: user.id,
        categoryId: rent.id,
        type: TransactionKind.EXPENSE,
        value: 1000,
        date: thisMonth(day),
        description: `Daily-${day}`,
      })
    }

    const response = await server.executeOperation(
      { query: DASHBOARD },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeUndefined()

    const data = response.body.singleResult.data?.['dashboard'] as {
      movement: { income: number; expense: number; totalBalance: number }
      recentTransactions: {
        description: string
        category: { title: string } | null
      }[]
      balanceByCategory: {
        categoryId: string
        title: string
        transactionCount: number
        totalValue: number
      }[]
    }

    expect(data.movement).toEqual({
      income: 500000,
      expense: 150000 + 5 * 1000,
      totalBalance: 500000 - (150000 + 5 * 1000),
    })

    expect(data.recentTransactions).toHaveLength(5)
    expect(data.recentTransactions.map((t) => t.description)).toEqual([
      'Daily-14',
      'Daily-13',
      'Daily-12',
      'Daily-11',
      'Daily-10',
    ])
    expect(data.recentTransactions[0]?.category?.title).toBe('Rent')

    expect(data.balanceByCategory).toEqual(
      expect.arrayContaining([
        {
          categoryId: salary.id,
          title: 'Salary',
          color: salary.color,
          transactionCount: 1,
          totalValue: 500000,
        },
        {
          categoryId: rent.id,
          title: 'Rent',
          color: rent.color,
          transactionCount: 6,
          totalValue: -(150000 + 5 * 1000),
        },
      ]),
    )
  })

  it('T-013: empty-month path — zeroed movement and empty balanceByCategory, but recentTransactions may include prior-month activity', async () => {
    const user = await createUser()
    const category = await createCategory(user.id, 'Old Category')

    await createTransaction({
      userId: user.id,
      categoryId: category.id,
      type: TransactionKind.EXPENSE,
      value: 4200,
      date: lastMonth(15),
      description: 'Last month purchase',
    })

    const response = await server.executeOperation(
      { query: DASHBOARD },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeUndefined()

    const data = response.body.singleResult.data?.['dashboard'] as {
      movement: { income: number; expense: number; totalBalance: number }
      recentTransactions: { description: string }[]
      balanceByCategory: unknown[]
    }

    expect(data.movement).toEqual({ income: 0, expense: 0, totalBalance: 0 })
    expect(data.balanceByCategory).toEqual([])
    expect(
      data.recentTransactions.some(
        (t) => t.description === 'Last month purchase',
      ),
    ).toBe(true)
  })

  it('T-014: unauthenticated request → UNAUTHENTICATED', async () => {
    const response = await server.executeOperation(
      { query: DASHBOARD },
      { contextValue: buildContext(null) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'UNAUTHENTICATED',
    )
  })
})
