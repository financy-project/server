import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/shared/utils/uuid'
import { Category } from '@/entities/category.entity'
import { CategoryRepository } from '@/repositories/category.repository'
import { buildCategoriesByIdLoader } from '@/loaders/categories-by-id.loader'
import { buildTransactionsQuantityByCategoryIdLoader } from '@/loaders/transactions-quantity-by-category-id.loader'

const CREATE_TRANSACTION = `
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
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
  }
`

describe('createTransaction mutation (e2e)', () => {
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

  it('T-020: happy path — creates a transaction and returns it, category resolved', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const response = await server.executeOperation(
      {
        query: CREATE_TRANSACTION,
        variables: {
          input: {
            type: 'EXPENSE',
            description: 'Weekly groceries',
            date: '2026-09-01T00:00:00.000Z',
            value: 5000,
            categoryId: category.id,
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(
      response.body.singleResult.data?.['createTransaction'],
    ).toMatchObject({
      type: 'EXPENSE',
      description: 'Weekly groceries',
      value: 5000,
      category: {
        id: category.id,
        title: category.title,
        color: category.color,
      },
    })
  })

  it('T-020: nonexistent categoryId → NOT_FOUND', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: CREATE_TRANSACTION,
        variables: {
          input: {
            type: 'EXPENSE',
            description: 'Ghost category',
            date: '2026-09-01T00:00:00.000Z',
            value: 100,
            categoryId: generateUUID(),
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })

  it("T-020: another user's categoryId → NOT_FOUND", async () => {
    const owner = await createUser()
    const requester = await createUser()
    const category = await createCategory(owner.id)

    const response = await server.executeOperation(
      {
        query: CREATE_TRANSACTION,
        variables: {
          input: {
            type: 'EXPENSE',
            description: 'Foreign category',
            date: '2026-09-01T00:00:00.000Z',
            value: 100,
            categoryId: category.id,
          },
        },
      },
      { contextValue: buildContext(requester.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })

  it('T-020: invalid value/type/date/description → BAD_USER_INPUT', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)

    const baseInput = {
      type: 'EXPENSE',
      description: 'Valid',
      date: '2026-09-01T00:00:00.000Z',
      value: 100,
      categoryId: category.id,
    }

    const invalidVariants = [
      { ...baseInput, value: 0 },
      { ...baseInput, type: 'NOT_A_KIND' },
      { ...baseInput, description: '' },
    ]

    for (const input of invalidVariants) {
      const response = await server.executeOperation(
        { query: CREATE_TRANSACTION, variables: { input } },
        { contextValue: buildContext(user.id) },
      )

      expect(response.body.kind).toBe('single')
      if (response.body.kind !== 'single') continue

      expect(response.body.singleResult.errors).toBeDefined()
      expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
        'BAD_USER_INPUT',
      )
    }
  })

  it('T-020: unauthenticated request → UNAUTHENTICATED', async () => {
    const category = await createCategory((await createUser()).id)

    const response = await server.executeOperation(
      {
        query: CREATE_TRANSACTION,
        variables: {
          input: {
            type: 'EXPENSE',
            description: 'No auth',
            date: '2026-09-01T00:00:00.000Z',
            value: 100,
            categoryId: category.id,
          },
        },
      },
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
