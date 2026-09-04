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
  ) {
    listTransactions(
      startDate: $startDate
      endDate: $endDate
      first: $first
      after: $after
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
            color
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
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

  const createCategory = async (userId: string) => {
    const category = Category.create({
      userId,
      title: `Cat-${generateUUID()}`,
      description: null,
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

  it('T-021: defaults to the current month when no date range is given', async () => {
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
    expect(descriptions).not.toContain(pastDesc)
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

  it('T-021: resolves category { id title color } for a linked category', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
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
        node: { category: { id: string; title: string; color: string } }
      }>
    }
    expect(result.edges[0]?.node.category).toMatchObject({
      id: category.id,
      title: category.title,
      color: category.color,
    })
  })
})
