import { ArgsType, Field, ID } from 'type-graphql'
import { IsUUID } from 'class-validator'

@ArgsType()
export class CategoryIdArgs {
  @Field(() => ID)
  @IsUUID('all', { message: 'validations.category_id_invalid' })
  id!: string
}
