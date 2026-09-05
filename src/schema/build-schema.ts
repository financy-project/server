import { buildSchema } from 'type-graphql'
import type { GraphQLSchema } from 'graphql'
import { HealthResolver } from '@/modules/health'
import { UserResolver } from '@/modules/user'
import { AuthResolver } from '@/modules/auth'
import { CategoryResolver } from '@/modules/category'
import { TransactionResolver } from '@/modules/transaction'
import { DashboardResolver } from '@/modules/dashboard'

export const buildAppSchema = (): Promise<GraphQLSchema> =>
  buildSchema({
    resolvers: [
      HealthResolver,
      UserResolver,
      AuthResolver,
      CategoryResolver,
      TransactionResolver,
      DashboardResolver,
    ],
    // Input validation is handled explicitly by validateInput() (see
    // docs/architecture/05-validation.md), not TypeGraphQL's automatic pass.
    validate: false,
    emitSchemaFile: {
      path: `${__dirname}/../../schema.graphql`,
    },
  })
