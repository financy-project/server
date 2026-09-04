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

const DELETE_TRANSACTION = `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`

const LIST_TRANSACTIONS = `
  query ListTransactions {
    listTransactions {
      edges {
        node {
          id
        }
      }
    }
  }
`

describe('deleteTransaction mutation (e2e)', () => {
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

  const createTransaction = async (userId: string, categoryId: string) =>
    TransactionRepository.create(
      Transaction.create({
        userId,
        categoryId,
        type: TransactionKind.EXPENSE,
        description: `Original-${generateUUID()}`,
        date: new Date(),
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

  it('T-022: happy path — deletes the transaction, no longer listed', async () => {
    const user = await createUser()
    const category = await createCategory(user.id)
    const transaction = await createTransaction(user.id, category.id)

    const response = await server.executeOperation(
      { query: DELETE_TRANSACTION, variables: { id: transaction.id } },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['deleteTransaction']).toBe(true)

    const listResponse = await server.executeOperation(
      { query: LIST_TRANSACTIONS },
      { contextValue: buildContext(user.id) },
    )
    if (listResponse.body.kind !== 'single') return
    const result = listResponse.body.singleResult.data?.[
      'listTransactions'
    ] as { edges: Array<{ node: { id: string } }> }
    expect(result.edges.map((edge) => edge.node.id)).not.toContain(
      transaction.id,
    )
  })

  it("T-022: deleting another user's transaction → NOT_FOUND", async () => {
    const owner = await createUser()
    const intruder = await createUser()
    const category = await createCategory(owner.id)
    const transaction = await createTransaction(owner.id, category.id)

    const response = await server.executeOperation(
      { query: DELETE_TRANSACTION, variables: { id: transaction.id } },
      { contextValue: buildContext(intruder.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })

  it('T-022: deleting a nonexistent id → NOT_FOUND', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      { query: DELETE_TRANSACTION, variables: { id: generateUUID() } },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })
})
