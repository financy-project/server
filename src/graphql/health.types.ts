import { Field, Float, ObjectType } from 'type-graphql'

export type HealthStatus = {
  status: string
  uptime: number
  connected: boolean
  version: string
}

@ObjectType()
export class HealthStatusType {
  @Field()
  status!: string

  @Field(() => Float)
  uptime!: number

  @Field()
  connected!: boolean

  @Field()
  version!: string
}

export const toHealthStatusType = (health: HealthStatus): HealthStatusType => {
  const type = new HealthStatusType()
  type.status = health.status
  type.uptime = health.uptime
  type.connected = health.connected
  type.version = health.version
  return type
}
