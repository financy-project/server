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

const UPDATE_CATEGORY = `
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      title
      color
    }
  }
`

describe('updateCategory mutation (e2e)', () => {
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
            title: `Original-${generateUUID()}`,
            description: null,
            icon: 'cart',
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
      throw new Error('Failed to seed category for update test')
    }

    return created.id
  }

  it('T-016: happy path — updates the fields and returns the updated CategoryType', async () => {
    const user = await createUser()
    const categoryId = await createCategory(user.id)

    const response = await server.executeOperation(
      {
        query: UPDATE_CATEGORY,
        variables: {
          id: categoryId,
          input: { title: 'Updated Title', color: '#999999' },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['updateCategory']).toMatchObject({
      id: categoryId,
      title: 'Updated Title',
      color: '#999999',
    })
  })

  it("T-016: updating another user's category → NOT_FOUND", async () => {
    const owner = await createUser()
    const intruder = await createUser()
    const categoryId = await createCategory(owner.id)

    const response = await server.executeOperation(
      {
        query: UPDATE_CATEGORY,
        variables: { id: categoryId, input: { title: 'Hijacked' } },
      },
      { contextValue: buildContext(intruder.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'NOT_FOUND',
    )
  })

  it('T-016: updating a nonexistent id → NOT_FOUND', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: UPDATE_CATEGORY,
        variables: { id: generateUUID(), input: { title: 'Ghost' } },
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
})
