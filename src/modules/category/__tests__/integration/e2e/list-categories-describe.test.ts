import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { prisma } from '@/lib/prisma'
import { generateUUID } from '@/shared/utils/uuid'

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
    loaders: {} as never,
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
})
