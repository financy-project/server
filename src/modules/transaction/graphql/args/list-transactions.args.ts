import { ArgsType, Field, Int } from 'type-graphql'
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

// Real @ArgsType() (unlike TransactionIdArgs) since listTransactions has
// multiple independent optional parameters. Cross-field checks (startDate/
// endDate must both be present, endDate >= startDate) live in
// ListTransactionsValidation, not here — class-validator decorators only
// validate each field in isolation.
@ArgsType()
export class ListTransactionsArgs {
  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate({ message: 'validations.transaction_date_invalid' })
  startDate?: Date

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate({ message: 'validations.transaction_date_invalid' })
  endDate?: Date

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'validations.transaction_first_min' })
  @Max(50, { message: 'validations.transaction_first_max' })
  first?: number

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  after?: string
}
