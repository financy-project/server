import 'reflect-metadata'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
import { buildApolloServer } from '@/app'
import { useDatabase } from '@/test/helpers/db'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/utils/constants'

const REGISTER_USER = `
  mutation RegisterUser($input: RegisterUserInput!) {
    registerUser(input: $input) {
      id
      email
      name
    }
  }
`

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      id
      email
      name
    }
  }
`

describe('login mutation (e2e)', () => {
  useDatabase()

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

  const seedUser = async (
    email = 'login@example.com',
    password = 'Supersecret1',
  ) => {
    await server.executeOperation(
      {
        query: REGISTER_USER,
        variables: {
          input: { email, name: 'Login User', password },
        },
      },
      { contextValue: mockContext },
    )
  }

  it('T-018: happy path — correct credentials → data.login matches { id, email, name }, no errors, cookies.set called with access_token + httpOnly: true', async () => {
    await seedUser()

    const response = await server.executeOperation(
      {
        query: LOGIN,
        variables: {
          input: { email: 'login@example.com', password: 'Supersecret1' },
        },
      },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['login']).toMatchObject({
      email: 'login@example.com',
      name: 'Login User',
    })
    const loginData = response.body.singleResult.data?.['login'] as
      Record<string, unknown> | undefined
    expect(loginData?.['id']).toBeTruthy()

    expect(cookiesSetSpy).toHaveBeenCalledTimes(1)
    expect(cookiesSetSpy).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    )
  })

  it('T-019: wrong password → errors[0].extensions.code === UNAUTHENTICATED', async () => {
    await seedUser()

    const response = await server.executeOperation(
      {
        query: LOGIN,
        variables: {
          input: { email: 'login@example.com', password: 'WrongPassword1' },
        },
      },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'UNAUTHENTICATED',
    )
  })

  it('T-020: unknown email → errors[0].extensions.code === UNAUTHENTICATED (same as wrong password)', async () => {
    const response = await server.executeOperation(
      {
        query: LOGIN,
        variables: {
          input: {
            email: 'nobody@example.com',
            password: 'SomePassword1',
          },
        },
      },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'UNAUTHENTICATED',
    )
  })

  it('T-021: malformed input (invalid email) → errors[0].extensions.code === BAD_USER_INPUT', async () => {
    const response = await server.executeOperation(
      {
        query: LOGIN,
        variables: {
          input: { email: 'not-an-email', password: 'SomePassword1' },
        },
      },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })

  it('T-021: malformed input (empty password) → errors[0].extensions.code === BAD_USER_INPUT', async () => {
    const response = await server.executeOperation(
      {
        query: LOGIN,
        variables: {
          input: { email: 'test@example.com', password: '' },
        },
      },
      { contextValue: mockContext },
    )

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return

    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })
})
