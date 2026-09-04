import { Field, ID, Int, ObjectType } from 'type-graphql'

@ObjectType()
export class CategoryType {
  @Field(() => ID)
  id!: string

  @Field()
  title!: string

  @Field(() => String, { nullable: true })
  description?: string | null

  @Field()
  icon!: string

  @Field()
  color!: string

  // Resolved via @FieldResolver on CategoryResolver (DataLoader), not a
  // plain mapped field.
  @Field(() => Int)
  transactionsQuantity!: number
}
