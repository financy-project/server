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
import {
  DEFAULT_CATEGORY_TITLE,
  DEFAULT_CATEGORY_ICON,
  DEFAULT_CATEGORY_COLOR,
} from '@/utils/constants'

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
            title
            icon
            color
          }
        }
      }
    }
  }
`

describe('deleting a category reassigns its transactions (e2e)', () => {
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

  const findTransactionNode = (
    listResponseData: unknown,
    transactionId: string,
  ) => {
    const result = listResponseData as {
      edges: Array<{
        node: {
          id: string
          category: {
            id: string
            title: string
            icon: string
            color: string
          } | null
        }
      }>
    }
    return result.edges.find((e) => e.node.id === transactionId)
  }

  it('T-023: deleting the category reassigns the transaction to the default "Outros" category (created on demand)', async () => {
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

    const edge = findTransactionNode(
      listResponse.body.singleResult.data?.['listTransactions'],
      transaction.id,
    )
    expect(edge).toBeDefined()
    expect(edge?.node.category).toMatchObject({
      title: DEFAULT_CATEGORY_TITLE,
      icon: DEFAULT_CATEGORY_ICON,
      color: DEFAULT_CATEGORY_COLOR,
    })
    expect(edge?.node.category?.id).not.toBe(category.id)
  })

  it('T-024: deleting a second category reuses the same "Outros" category instead of creating another one', async () => {
    const user = await createUser()
    const categoryA = await CategoryRepository.create(
      Category.create({
        userId: user.id,
        title: `Cat-A-${generateUUID()}`,
        description: null,
        icon: 'cart',
        color: '#123456',
      }),
    )
    const categoryB = await CategoryRepository.create(
      Category.create({
        userId: user.id,
        title: `Cat-B-${generateUUID()}`,
        description: null,
        icon: 'car',
        color: '#654321',
      }),
    )
    const transactionA = await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: categoryA.id,
        type: TransactionKind.EXPENSE,
        description: 'A',
        date: new Date(),
        value: 100,
      }),
    )
    const transactionB = await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: categoryB.id,
        type: TransactionKind.EXPENSE,
        description: 'B',
        date: new Date(),
        value: 100,
      }),
    )

    await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: categoryA.id } },
      { contextValue: buildContext(user.id) },
    )
    await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: categoryB.id } },
      { contextValue: buildContext(user.id) },
    )

    const listResponse = await server.executeOperation(
      { query: LIST_TRANSACTIONS },
      { contextValue: buildContext(user.id) },
    )
    if (listResponse.body.kind !== 'single') return

    const edgeA = findTransactionNode(
      listResponse.body.singleResult.data?.['listTransactions'],
      transactionA.id,
    )
    const edgeB = findTransactionNode(
      listResponse.body.singleResult.data?.['listTransactions'],
      transactionB.id,
    )
    expect(edgeA?.node.category?.id).toBeTruthy()
    expect(edgeA?.node.category?.id).toBe(edgeB?.node.category?.id)

    const outrosCount = await prisma.category.count({
      where: { userId: user.id, title: DEFAULT_CATEGORY_TITLE },
    })
    expect(outrosCount).toBe(1)
  })

  it('T-025: deleting the default "Outros" category itself sets its transactions to null (no fallback loop)', async () => {
    const user = await createUser()
    const outros = await CategoryRepository.create(
      Category.create({
        userId: user.id,
        title: DEFAULT_CATEGORY_TITLE,
        description: null,
        icon: DEFAULT_CATEGORY_ICON,
        color: DEFAULT_CATEGORY_COLOR,
      }),
    )
    const transaction = await TransactionRepository.create(
      Transaction.create({
        userId: user.id,
        categoryId: outros.id,
        type: TransactionKind.EXPENSE,
        description: 'Misc',
        date: new Date(),
        value: 100,
      }),
    )

    const deleteResponse = await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: outros.id } },
      { contextValue: buildContext(user.id) },
    )
    if (deleteResponse.body.kind !== 'single') return
    expect(deleteResponse.body.singleResult.errors).toBeUndefined()

    const listResponse = await server.executeOperation(
      { query: LIST_TRANSACTIONS },
      { contextValue: buildContext(user.id) },
    )
    if (listResponse.body.kind !== 'single') return

    const edge = findTransactionNode(
      listResponse.body.singleResult.data?.['listTransactions'],
      transaction.id,
    )
    expect(edge?.node.category).toBeNull()
  })
})
