import { HealthStatusType } from '../graphql/object-types/health.object-type'
import type { HealthStatus } from '../types'

export const toHealthStatusType = (health: HealthStatus): HealthStatusType => {
  const type = new HealthStatusType()
  type.status = health.status
  type.uptime = health.uptime
  return type
}
