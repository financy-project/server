import 'reflect-metadata'
import { ApolloServer } from '@apollo/server'
import { buildAppSchema } from '@/schema/build-schema'
import { getAppVersion } from '@/config/app-version'
import { useDatabase } from '@/test/helpers/db'

describe('health query (e2e)', () => {
  useDatabase()

  let server: ApolloServer

  beforeAll(async () => {
    server = new ApolloServer({ schema: await buildAppSchema() })
  })

  afterAll(async () => {
    await server.stop()
  })

  it('returns connected: true and the server version when the database is reachable', async () => {
    const response = await server.executeOperation({
      query: `
        query Health {
          health { status uptime connected version }
        }
      `,
    })

    expect(response.body.kind).toBe('single')
    if (response.body.kind !== 'single') return
    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['health']).toMatchObject({
      status: 'ok',
      connected: true,
      version: getAppVersion(),
    })
  })
})
