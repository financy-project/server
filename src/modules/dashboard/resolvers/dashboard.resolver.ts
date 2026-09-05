import 'reflect-metadata'
import { Ctx, Query, Resolver } from 'type-graphql'
import type { GraphQLContext } from '@/context/create-context'
import { requireCurrentUser } from '@/shared/utils'
import { GetDashboardUseCase } from '../use-cases'
import { DashboardType } from '../graphql/object-types'
import { toDashboardType } from '../mappers'

@Resolver(() => DashboardType)
export class DashboardResolver {
  @Query(() => DashboardType, { complexity: 6 })
  async dashboard(@Ctx() ctx: GraphQLContext): Promise<DashboardType> {
    const { id: userId } = requireCurrentUser(ctx)
    const summary = await GetDashboardUseCase.getDashboard(userId)
    return toDashboardType(summary)
  }
}
