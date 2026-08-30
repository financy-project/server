import { IsUUID } from 'class-validator'

// Plain validateInput() DTO, not a bound GraphQL @ArgsType — every mutation
// takes `id` as a hand-rolled @Arg('id') and validates it through
// CategoryIdValidation.validate() (buildSchema runs with `validate: false`;
// see src/schema/build-schema.ts), so no TypeGraphQL decorators belong here.
export class CategoryIdArgs {
  @IsUUID('all', { message: 'validations.category_id_invalid' })
  id!: string
}
