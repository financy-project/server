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
      description
      icon
      color
    }
  }
`

describe('createCategory mutation (e2e)', () => {
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

  const buildContext = (userId: string | null): GraphQLContext => ({
    currentUser: userId ? { id: userId } : null,
    locale: 'en',
    loaders: {} as never,
    cookies: { get: jest.fn(), set: jest.fn() },
  })

  it('T-014: happy path — creates a category and returns it, no errors', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: 'Groceries',
            description: 'Weekly food shopping',
            icon: 'cart',
            color: '#FF00AA',
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['createCategory']).toMatchObject({
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    })
  })

  it('T-014: duplicate title for the same user → CONFLICT', async () => {
    const user = await createUser()
    const input = {
      title: 'Rent',
      description: null,
      icon: 'home',
      color: '#00FF00',
    }

    await server.executeOperation(
      { query: CREATE_CATEGORY, variables: { input } },
      { contextValue: buildContext(user.id) },
    )

    const response = await server.executeOperation(
      { query: CREATE_CATEGORY, variables: { input } },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'CONFLICT',
    )
  })

  it('T-014: invalid color (not #RRGGBB) → BAD_USER_INPUT', async () => {
    const user = await createUser()

    const response = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: 'Invalid Color',
            description: null,
            icon: 'cart',
            color: 'not-a-color',
          },
        },
      },
      { contextValue: buildContext(user.id) },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })

  it('T-014: unauthenticated request → UNAUTHENTICATED', async () => {
    const response = await server.executeOperation(
      {
        query: CREATE_CATEGORY,
        variables: {
          input: {
            title: 'No Auth',
            description: null,
            icon: 'cart',
            color: '#123456',
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
