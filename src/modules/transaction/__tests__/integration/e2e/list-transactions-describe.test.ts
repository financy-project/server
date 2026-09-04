import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/shared/utils/uuid'
import { Category, CategoryRepository } from '@/modules/category'
import {
  Transaction,
  TransactionRepository,
  TransactionKind,
} from '@/modules/transaction'
import { buildCategoriesByIdLoader } from '@/modules/transaction/loaders'
import { buildTransactionsQuantityByCategoryIdLoader } from '@/modules/category/loaders'

const LIST_TRANSACTIONS = `
  query ListTransactions(
    $startDate: DateTimeISO
    $endDate: DateTimeISO
    $first: Int
    $after: String
    $description: String
    $type: TransactionKind
    $categoryIds: [ID!]
    $month: Int
    $year: Int
  ) {
    listTransactions(
      startDate: $startDate
      endDate: $endDate
      first: $first
      after: $after
      description: $description
      type: $type
      categoryIds: $categoryIds
      month: $month
      year: $year
    ) {
      edges {
        cursor
        node {
          id
          description
          date
          value
          category {
            id
            title
            description
            icon
            color
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalRecord
    }
  }
`

describe('listTransactions query (e2e)', () => {
  useDatabase()

  let server: ApolloServer<GraphQLContext>

  beforeAll(async () => {
    server = await buildApolloServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  const createUser = async () => {
    const id = generateUUID()
    return prisma.user.create({
      data: { id, email: `${id}@example.com`, name: 'Test User' },
    })
  }

  const createCategory = async (
    userId: string,
    description: string | null = null,
  ) => {
    const category = Category.create({
      userId,
      title: `Cat-${generateUUID()}`,
      description,
      icon: 'cart',
      color: '#123456',
    })
    return CategoryRepository.create(category)
  }

  const createTransaction = async (
    userId: string,
    categoryId: string,
    date: Date,
    description = `Txn-${generateUUID()}`,
  ) =>
    TransactionRepository.create(
      Transaction.create({
        userId,
        categoryId,
        type: TransactionKind.EXPENSE,
        description,
        date,
        value: 100,
      }),
    )

  const buildContext = (userId: string): GraphQLContext => ({
    currentUser: { id: userId },
    locale: 'en',
    loaders: {
      categoriesById: buildCategoriesByIdLoader(),
      transactionsQuantityByCategoryId:
        buildTransactionsQuantityByCategoryIdLoader(),
    },
    cookies: { get: jest.fn(), set: jest.fn() },
  })

  it("T-021: returns only the caller's own transactions, not another user's", async () => {
    const userA = await createUser()
    const userB = await createUser()
    const categoryA = await createCategory(userA.id)
    const categoryB = await createCategory(userB.id)

    const descA = `A-${generateUUID()}`
    const descB = `B-${generateUUID()}`
    await createTransaction(userA.id, categoryA.id, new Date(), descA)
    await createTransaction(userB.id, categoryB.id, new Date(), descB)

    const response = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(userA.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(descA)
    expect(descriptions).not.toContain(descB)
  })

  it('T-021: no filters at all returns transactions from every period, not just the current month', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const now = new Date()
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15),
    )

    const currentDesc = `Current-${generateUUID()}`
    const pastDesc = `Past-${generateUUID()}`
    await createTransaction(user.id, category.id, now, currentDesc)
    await createTransaction(user.id, category.id, lastMonth, pastDesc)

    const response = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(currentDesc)
    expect(descriptions).toContain(pastDesc)
  })

  it('T-021: filters by description alone', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const matchDesc = `Compra no mercado ${generateUUID()}`
    const otherDesc = `Cinema-${generateUUID()}`
    await createTransaction(user.id, category.id, new Date(), matchDesc)
    await createTransaction(user.id, category.id, new Date(), otherDesc)

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { description: 'MERCADO' },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(matchDesc)
    expect(descriptions).not.toContain(otherDesc)
  })

  it('T-021: filters by type alone', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const expenseDesc = `Expense-${generateUUID()}`
    const incomeDesc = `Income-${generateUUID()}`
    await createTransaction(user.id, category.id, new Date(), expenseDesc)
    await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.INCOME,
        description: incomeDesc,
        date: new Date(),
        value: 100,
      }),
    )

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { type: 'EXPENSE' },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(expenseDesc)
    expect(descriptions).not.toContain(incomeDesc)
  })

  it('T-021: filters by categoryIds alone', async () => {
    const user = await createUser()
    const categoryA = await createCategory(user.id)
    const categoryB = await createCategory(user.id)

    const descA = `A-${generateUUID()}`
    const descB = `B-${generateUUID()}`
    await createTransaction(user.id, categoryA.id, new Date(), descA)
    await createTransaction(user.id, categoryB.id, new Date(), descB)

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { categoryIds: [categoryA.id] },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(descA)
    expect(descriptions).not.toContain(descB)
  })

  it('T-021: filters by month+year alone', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const inMonthDesc = `InMonth-${generateUUID()}`
    const outOfMonthDesc = `OutOfMonth-${generateUUID()}`
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-15T00:00:00.000Z'),
      inMonthDesc,
    )
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-02-15T00:00:00.000Z'),
      outOfMonthDesc,
    )

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { month: 1, year: 2026 },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(inMonthDesc)
    expect(descriptions).not.toContain(outOfMonthDesc)
  })

  it('T-021: combines description + type + categoryIds + month + year in one call', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
    const otherCategory = await createCategory(user.id)

    const matchDesc = `Compra no mercado ${generateUUID()}`
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-15T00:00:00.000Z'),
      matchDesc,
    )
    // wrong category
    await createTransaction(
      user.id,
      otherCategory.id,
      new Date('2026-01-15T00:00:00.000Z'),
      `Compra no mercado ${generateUUID()}`,
    )
    // wrong month
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-02-15T00:00:00.000Z'),
      `Compra no mercado ${generateUUID()}`,
    )
    // wrong type
    await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.INCOME,
        description: `Compra no mercado ${generateUUID()}`,
        date: new Date('2026-01-15T00:00:00.000Z'),
        value: 100,
      }),
    )

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: {
          description: 'mercado',
          type: 'EXPENSE',
          categoryIds: [category.id],
          month: 1,
          year: 2026,
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]?.node.description).toBe(matchDesc)
  })

  it('T-021: a categoryIds entry belonging to another user returns no rows for that id', async () => {
    const userA = await createUser()
    const userB = await createUser()
    const categoryB = await createCategory(userB.id)
    await createTransaction(userB.id, categoryB.id, new Date())

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { categoryIds: [categoryB.id] },
      },
      { contextValue: buildContext(userA.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: unknown[]
    }
    expect(result.edges).toHaveLength(0)
  })

  it('T-021: month without year returns a BAD_USER_INPUT error', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { month: 1 },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })

  it('T-021: month+year combined with startDate returns a BAD_USER_INPUT error', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: {
          month: 1,
          year: 2026,
          startDate: '2026-01-01T00:00:00.000Z',
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })

  it('T-021: respects an explicit startDate/endDate filter', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const inRangeDesc = `InRange-${generateUUID()}`
    const outOfRangeDesc = `OutOfRange-${generateUUID()}`
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-15T00:00:00.000Z'),
      inRangeDesc,
    )
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-03-15T00:00:00.000Z'),
      outOfRangeDesc,
    )

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { description: string } }>
    }
    const descriptions = result.edges.map((edge) => edge.node.description)
    expect(descriptions).toContain(inRangeDesc)
    expect(descriptions).not.toContain(outOfRangeDesc)
  })

  it('T-021: paginates correctly across first/after', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-01T00:00:00.000Z'),
    )
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-02T00:00:00.000Z'),
    )
    await createTransaction(
      user.id,
      category.id,
      new Date('2026-01-03T00:00:00.000Z'),
    )

    const firstPage = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          first: 2,
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(firstPage.body.kind).toBe('single')
    if (firstPage.body.kind !== 'single') return

    const firstResult = firstPage.body.singleResult.data?.[
      'listTransactions'
    ] as {
      edges: Array<{ cursor: string }>
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
    expect(firstResult.edges).toHaveLength(2)
    expect(firstResult.pageInfo.hasNextPage).toBe(true)
    expect(firstResult.pageInfo.endCursor).toBeTruthy()

    const secondPage = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
          first: 2,
          after: firstResult.pageInfo.endCursor,
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(secondPage.body.kind).toBe('single')
    if (secondPage.body.kind !== 'single') return

    const secondResult = secondPage.body.singleResult.data?.[
      'listTransactions'
    ] as {
      edges: Array<{ cursor: string }>
      pageInfo: { hasNextPage: boolean }
    }
    expect(secondResult.edges).toHaveLength(1)
    expect(secondResult.pageInfo.hasNextPage).toBe(false)
  })

  it('T-008: resolves the full category object (id, title, description, icon, color) for a linked category', async () => {
    const user = await createUser()
    const category = await createCategory(user.id, 'Food purchases')
    await createTransaction(user.id, category.id, new Date())

    const response = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{
        node: {
          category: {
            id: string
            title: string
            description: string | null
            icon: string
            color: string
          }
        }
      }>
    }
    expect(result.edges[0]?.node.category).toMatchObject({
      id: category.id,
      title: category.title,
      description: 'Food purchases',
      icon: category.icon,
      color: category.color,
    })
  })

  it('T-009: resolves category as null for a transaction without one', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
    await createTransaction(
      user.id,
      category.id,
      new Date(),
      `NoCategory-${generateUUID()}`,
    )
    // Deleting the category cascades categoryId to null on its transactions
    // (onDelete: SetNull) — the realistic way a transaction ends up with no
    // category, since Transaction.create() requires one at creation time.
    await CategoryRepository.remove(category.id)

    const response = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: Array<{ node: { category: unknown } }>
    }
    expect(result.edges[0]?.node.category).toBeNull()
  })

  it('T-010: totalRecord equals the full filtered-match count while edges only holds the current page', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
    await Promise.all(
      [1, 2, 3, 4, 5].map((day) =>
        createTransaction(
          user.id,
          category.id,
          new Date(`2026-01-0${day}T00:00:00.000Z`),
        ),
      ),
    )

    const response = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { first: 2 },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const result = response.body.singleResult.data?.['listTransactions'] as {
      edges: unknown[]
      totalRecord: number
    }
    expect(result.edges).toHaveLength(2)
    expect(result.totalRecord).toBe(5)
  })

  it('T-011: totalRecord changes correctly as filters narrow the result set', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
    const matchDesc = `Compra no mercado ${generateUUID()}`
    await createTransaction(user.id, category.id, new Date(), matchDesc)
    await createTransaction(user.id, category.id, new Date())
    await createTransaction(user.id, category.id, new Date())

    const unfiltered = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(user.id) },
    )
    const filtered = await server.executeOperation(
      {
        query: LIST_TRANSACTIONS,
        variables: { description: 'MERCADO' },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(unfiltered.body.kind).toBe('single')
    expect(filtered.body.kind).toBe('single')
    if (unfiltered.body.kind !== 'single' || filtered.body.kind !== 'single')
      return

    const unfilteredResult = unfiltered.body.singleResult.data?.[
      'listTransactions'
    ] as { totalRecord: number }
    const filteredResult = filtered.body.singleResult.data?.[
      'listTransactions'
    ] as { totalRecord: number }

    expect(unfilteredResult.totalRecord).toBe(3)
    expect(filteredResult.totalRecord).toBe(1)
  })

  it('T-012: totalRecord never includes another user’s transactions', async () => {
    const userA = await createUser()
    const userB = await createUser()
    const categoryA = await createCategory(userA.id)
    const categoryB = await createCategory(userB.id)
    await createTransaction(userA.id, categoryA.id, new Date())
    await createTransaction(userB.id, categoryB.id, new Date())
    await createTransaction(userB.id, categoryB.id, new Date())

    const response = await server.executeOperation(
      { query: LIST_TRANSACTIONS, variables: {} },
      { contextValue: buildContext(userA.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    const result = response.body.singleResult.data?.['listTransactions'] as {
      totalRecord: number
    }
    expect(result.totalRecord).toBe(1)
  })
})
