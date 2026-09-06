import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/utils/constants'

const LOGOUT = `
  mutation Logout {
    logout
  }
`

describe('logout mutation (e2e)', () => {
  let server: ApolloServer<GraphQLContext>
  const cookiesSetSpy = jest.fn()

  const mockContext: GraphQLContext = {
    currentUser: null,
    locale: 'en',
    loaders: {} as never,
    cookies: {
      get: jest.fn(),
      set: cookiesSetSpy,
    },
  }

  beforeAll(async () => {
    server = await buildApolloServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-001: happy path — returns true and clears the access_token cookie (Max-Age=0)', async () => {
    const response = await server.executeOperation(
      { query: LOGOUT },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['logout']).toBe(true)

    expect(cookiesSetSpy).toHaveBeenCalledTimes(1)
    expect(cookiesSetSpy).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE_NAME,
      '',
      expect.objectContaining({ httpOnly: true, maxAgeSeconds: 0 }),
    )
  })

  it('T-002: no session cookie present → still returns true (idempotent)', async () => {
    const response = await server.executeOperation(
      { query: LOGOUT },
      {
        contextValue: {
          ...mockContext,
          cookies: { get: jest.fn(() => undefined), set: cookiesSetSpy },
        },
      },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['logout']).toBe(true)
  })
})
