import 'reflect-metadata'
import { ApolloServer } from '@apollo/server'
import { buildAppSchema } from '@/schema/build-schema'

describe('health query (e2e)', () => {
  let server: ApolloServer

  beforeAll(async () => {
    server = new ApolloServer({ schema: await buildAppSchema() })
  })

  afterAll(async () => {
    await server.stop()
  })

  it('returns status ok', async () => {
    const response = await server.executeOperation({
      query: `
        query Health {
          health { status uptime }
        }
      `,
    })

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['health']).toMatchObject({
      status: 'ok',
    })
  })
})
