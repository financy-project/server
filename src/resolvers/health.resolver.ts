import { Query, Resolver } from 'type-graphql'
import { getAppVersion } from '@/config/app-version'
import { HealthRepository } from '@/repositories/health.repository'
import { HealthStatusType, toHealthStatusType } from '@/graphql/health.types'

@Resolver(() => HealthStatusType)
export class HealthResolver {
  @Query(() => HealthStatusType)
  async health(): Promise<HealthStatusType> {
    const connected = await HealthRepository.checkDatabaseConnection()

    return toHealthStatusType({
      status: connected ? 'ok' : 'degraded',
      uptime: process.uptime(),
      connected,
      version: getAppVersion(),
    })
  }
}
