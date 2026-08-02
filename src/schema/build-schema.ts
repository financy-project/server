import { buildSchema } from 'type-graphql'
import type { GraphQLSchema } from 'graphql'
import { HealthResolver } from '@/modules/health'

export const buildAppSchema = (): Promise<GraphQLSchema> =>
  buildSchema({
    resolvers: [HealthResolver],
    // Input validation is handled explicitly by validateInput() (see
    // docs/architecture/05-validation.md), not TypeGraphQL's automatic pass.
    validate: false,
    emitSchemaFile: {
      path: `${__dirname}/../../schema.graphql`,
    },
  })
