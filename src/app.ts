import { ApolloServer } from '@apollo/server'
import express, { type Express } from 'express'
import cors from 'cors'
import { expressMiddleware } from '@as-integrations/express5'
import type { GraphQLContext } from '@/context/create-context'
import { createContext } from '@/context/create-context'
import { buildAppSchema } from '@/schema/build-schema'
import { formatError } from '@/plugins/format-error'
import { Environments } from '@/config/environments'

export const buildApolloServer = async (): Promise<
  ApolloServer<GraphQLContext>
> => {
  const schema = await buildAppSchema()

  return new ApolloServer<GraphQLContext>({
    schema,
    formatError,
    includeStacktraceInErrorResponses: !Environments.isProduction,
  })
}

export const buildExpressApp = async (
  server: ApolloServer<GraphQLContext>,
  allowedOrigins: readonly string[],
): Promise<Express> => {
  await server.start()

  const app = express()
  app.use(
    '/graphql',
    cors({ origin: [...allowedOrigins], credentials: true }),
    express.json(),
    expressMiddleware(server, { context: createContext }),
  )

  return app
}
