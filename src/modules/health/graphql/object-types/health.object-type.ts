import { Field, Float, ObjectType } from 'type-graphql'

@ObjectType()
export class HealthStatusType {
  @Field()
  status!: string

  @Field(() => Float)
  uptime!: number
}
