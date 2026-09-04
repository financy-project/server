import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/shared/utils/uuid'
import { buildTransactionsQuantityByCategoryIdLoader } from '@/modules/category/loaders'
import {
  Transaction,
  TransactionRepository,
  TransactionKind,
} from '@/modules/transaction'

const CREATE_CATEGORY = `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      title
    }
  }
`

const LIST_CATEGORIES = `
  query ListCategories {
    listCategories {
      id
      title
      transactionsQuantity
    }
  }
`

describe('listCategories query (e2e)', () => {
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
      transactionsQuantityByCategoryId:
        buildTransactionsQuantityByCategoryIdLoader(),
    } as never,
    cookies: { get: jest.fn(), set: jest.fn() },
  })

  it("T-015: returns only the caller's own categories, not another user's", async () => {
    const userA = await createUser()
    const userB = await createUser()

    const titleA = `A-${generateUUID()}`
    const titleB = `B-${generateUUID()}`

    await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: titleA,
            description: null,
            icon: 'a',
            color: '#111111',
          },
        },
      },
      { contextValue: buildContext(userA.id) },
    )
    await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: titleB,
            description: null,
            icon: 'b',
            color: '#222222',
          },
        },
      },
      { contextValue: buildContext(userB.id) },
    )

    const response = await server.executeOperation(
      { query: LIST_CATEGORIES },
      { contextValue: buildContext(userA.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const categories = response.body.singleResult.data?.['listCategories'] as
      Array<{ title: string }> | undefined

    const titles = categories?.map((category) => category.title) ?? []
    expect(titles).toContain(titleA)
    expect(titles).not.toContain(titleB)
  })

  it("T-010, T-011, T-012: reports each category's own independent transactionsQuantity", async () => {
    const user = await createUser()

    const withTransactionsResponse = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: `WithTx-${generateUUID()}`,
            description: null,
            icon: 'a',
            color: '#111111',
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )
    const emptyResponse = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: `Empty-${generateUUID()}`,
            description: null,
            icon: 'b',
            color: '#222222',
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(withTransactionsResponse.body.kind).toBe('single')
    expect(emptyResponse.body.kind).toBe('single')
    if (
      withTransactionsResponse.body.kind !== 'single' ||
      emptyResponse.body.kind !== 'single'
    ) {
      return
    }

    const categoryWithTransactionsId = (
      withTransactionsResponse.body.singleResult.data?.['createCategory'] as {
        id: string
      }
    ).id
    const emptyCategoryId = (
      emptyResponse.body.singleResult.data?.['createCategory'] as {
        id: string
      }
    ).id

    for (let i = 0; i < 3; i++) {
      await TransactionRepository.create(
        Transaction.create({
          userId: user.id,
          categoryId: categoryWithTransactionsId,
          type: TransactionKind.EXPENSE,
          description: `Transaction ${i}`,
          date: new Date('2026-01-01'),
          value: 100,
        }),
      )
    }

    const response = await server.executeOperation(
      { query: LIST_CATEGORIES },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    const categories = response.body.singleResult.data?.['listCategories'] as
      Array<{ id: string; transactionsQuantity: number }> | undefined

    const withTransactions = categories?.find(
      (category) => category.id === categoryWithTransactionsId,
    )
    const empty = categories?.find(
      (category) => category.id === emptyCategoryId,
    )

    expect(withTransactions?.transactionsQuantity).toBe(3)
    expect(empty?.transactionsQuantity).toBe(0)
  })
})
