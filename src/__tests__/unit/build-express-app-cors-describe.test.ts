import 'reflect-metadata'
import request from 'supertest'
import { buildApolloServer, buildExpressApp } from '../../app'

describe('buildExpressApp CORS', () => {
  const ALLOWED_ORIGIN = 'http://allowed.test'
  const DISALLOWED_ORIGIN = 'http://evil.test'

  it('T-001: allowed origin on POST /graphql receives access-control-allow-origin and access-control-allow-credentials headers', async () => {
    const app = await buildExpressApp(await buildApolloServer(), [
      ALLOWED_ORIGIN,
    ])

    const response = await request(app)
      .post('/graphql')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ query: '{ __typename }' })

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('T-002: disallowed origin on POST /graphql receives no access-control-allow-origin header', async () => {
    const app = await buildExpressApp(await buildApolloServer(), [
      ALLOWED_ORIGIN,
    ])

    const response = await request(app)
      .post('/graphql')
      .set('Origin', DISALLOWED_ORIGIN)
      .send({ query: '{ __typename }' })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('T-003: preflight OPTIONS /graphql from an allowed origin resolves 204 with access-control-allow-methods including POST', async () => {
    const app = await buildExpressApp(await buildApolloServer(), [
      ALLOWED_ORIGIN,
    ])

    const response = await request(app)
      .options('/graphql')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('POST')
  })
})
