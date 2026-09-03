import { Field, ID, ObjectType } from 'type-graphql'

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
}
