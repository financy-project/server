import 'reflect-metadata'
import { ApolloServer } from '@apollo/server'
import { buildAppSchema } from '@/schema/build-schema'
import { useDatabase } from '@/test/helpers/db'

describe('registerUser mutation (e2e)', () => {
  useDatabase()

  let server: ApolloServer

  beforeAll(async () => {
    server = new ApolloServer({ schema: await buildAppSchema() })
  })

  afterAll(async () => {
    await server.stop()
  })

  it('T-017: happy path returns id, email, name with no errors', async () => {
    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) {
            id
            email
            name
          }
        }
      `,
      variables: {
        input: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'Supersecret1',
        },
      },
    })

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['registerUser']).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
    })
    const regUser = response.body.singleResult.data?.['registerUser'] as
      Record<string, unknown> | undefined
    expect(regUser?.['id']).toBeTruthy()
  })

  it('T-018: duplicate email returns CONFLICT error code', async () => {
    const input = {
      email: 'duplicate@example.com',
      name: 'Dup User',
      password: 'Supersecret1',
    }

    await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id }
        }
      `,
      variables: { input },
    })

    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id }
        }
      `,
      variables: { input },
    })

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'CONFLICT',
    )
  })

  it('T-019: invalid input returns BAD_USER_INPUT error code', async () => {
    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id }
        }
      `,
      variables: {
        input: {
          email: 'not-an-email',
          name: '',
          password: 'weak',
        },
      },
    })

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeDefined()
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })
})
