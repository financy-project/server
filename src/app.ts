import { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '@/context/create-context'
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
