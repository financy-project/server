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
    }
  }
`

const DELETE_CATEGORY = `
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`

const LIST_CATEGORIES = `
  query ListCategories {
    listCategories {
      id
    }
  }
`

describe('deleteCategory mutation (e2e)', () => {
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

  const createCategory = async (userId: string) => {
    const response = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: `ToDelete-${generateUUID()}`,
            description: null,
            icon: 'trash',
            color: '#111111',
          },
        },
      },
      { contextValue: buildContext(userId) },
    )

    if (response.body.kind !== 'single') {
      throw new Error('Expected a single GraphQL result')
    }

    const created = response.body.singleResult.data?.['createCategory'] as
      { id: string } | undefined

    if (!created) {
      throw new Error('Failed to seed category for delete test')
    }

    return created.id
  }

  it('T-016: happy path — returns true and the category no longer appears in listCategories', async () => {
    const user = await createUser()
    const categoryId = await createCategory(user.id)

    const response = await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: categoryId } },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['deleteCategory']).toBe(true)

    const listResponse = await server.executeOperation(
      { query: LIST_CATEGORIES },
      { contextValue: buildContext(user.id) },
    )
    if (listResponse.body.kind !== 'single') return

    const categories = listResponse.body.singleResult.data?.[
      'listCategories'
    ] as Array<{ id: string }> | undefined
    expect(categories?.map((category) => category.id)).not.toContain(categoryId)
  })

  it("T-016: deleting another user's category → NOT_FOUND", async () => {
    const owner = await createUser()
    const intruder = await createUser()
    const categoryId = await createCategory(owner.id)

    const response = await server.executeOperation(
      { query: DELETE_CATEGORY, variables: { id: categoryId } },
      { contextValue: buildContext(intruder.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })
})
