import { Field, ID, ObjectType } from 'type-graphql'

// Local to this module, deliberately NOT the category module's own
// CategoryType — module isolation: the transaction module must not depend
// on the category module's GraphQL shape.
@ObjectType()
export class TransactionCategoryType {
  @Field(() => ID)
  id!: string

  @Field()
  title!: string

  @Field()
  color!: string

  @Field(() => String, { nullable: true })
  description?: string | null

  @Field()
  icon!: string
}
