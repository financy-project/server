import { IsUUID } from 'class-validator'

// Plain validateInput() DTO, not a bound GraphQL @ArgsType — mirrors
// CategoryIdArgs exactly (see src/modules/category/graphql/args/category-id.args.ts).
export class TransactionIdArgs {
  @IsUUID('all', { message: 'validations.transaction_id_invalid' })
  id!: string
}
