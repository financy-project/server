import { Query, Resolver } from 'type-graphql'
import { HealthStatusType } from '../graphql/object-types/health.object-type'
import { toHealthStatusType } from '../mappers/health.mapper'
import { GetHealthUseCase } from '../use-cases/get-health.use-case'

@Resolver(() => HealthStatusType)
export class HealthResolver {
  @Query(() => HealthStatusType)
  health(): HealthStatusType {
    return toHealthStatusType(GetHealthUseCase.getHealth())
  }
}
