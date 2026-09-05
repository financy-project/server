import { Field, ID, Int, ObjectType } from 'type-graphql'

@ObjectType()
export class DashboardCategoryBalanceType {
  @Field(() => ID)
  categoryId!: string

  @Field()
  title!: string

  @Field()
  color!: string

  @Field(() => Int)
  transactionCount!: number

  @Field(() => Int)
  totalValue!: number
}
