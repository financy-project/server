import { Field, ObjectType } from 'type-graphql'

// Shared cursor-pagination primitive — first paginated field in the app.
@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage!: boolean

  @Field(() => String, { nullable: true })
  endCursor?: string | null
}
