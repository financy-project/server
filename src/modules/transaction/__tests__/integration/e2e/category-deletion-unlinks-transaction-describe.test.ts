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

const DELETE_CATEGORY = `
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`

const LIST_TRANSACTIONS = `
  query ListTransactions {
    listTransactions {
      edges {
        node {
          id
          category {
            id
          }
        }
      }
    }
  }
`

describe('deleting a category unlinks its transactions (e2e)', () => {
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

  it("T-023: deleting the category sets the transaction's category to null, transaction still listable", async () => {
    const user = await createUser()
    const category = await CategoryRepository.create(
      Category.create({
        userId: user.id,
        title: `Cat-${generateUUID()}`,
        description: null,
        icon: 'cart',
        color: '#123456',
      }),
    )
    const transaction = await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date(),
        value: 100,
      }),
    )

    const deleteResponse = await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: category.id } },
      { contextValue: buildContext(user.id) },
    )
    expect(deleteResponse.body.kind).toBe('single')
    if (deleteResponse.body.kind !== 'single') return
    expect(deleteResponse.body.singleResult.errors).toBeUndefined()

    const listResponse = await server.executeOperation(
      { query: LIST_TRANSACTIONS },
      { contextValue: buildContext(user.id) },
    )
    expect(listResponse.body.kind).toBe('single')
    if (listResponse.body.kind !== 'single') return
    expect(listResponse.body.singleResult.errors).toBeUndefined()

    const result = listResponse.body.singleResult.data?.[
      'listTransactions'
    ] as { edges: Array<{ node: { id: string; category: null } }> }
    const edge = result.edges.find((e) => e.node.id === transaction.id)
    expect(edge).toBeDefined()
    expect(edge?.node.category).toBeNull()
  })
})
