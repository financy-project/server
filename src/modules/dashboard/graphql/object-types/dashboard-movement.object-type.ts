import { Field, Int, ObjectType } from 'type-graphql'

@ObjectType()
export class DashboardMovementType {
  @Field(() => Int)
  income!: number

  @Field(() => Int)
  expense!: number

  @Field(() => Int)
  totalBalance!: number
}
