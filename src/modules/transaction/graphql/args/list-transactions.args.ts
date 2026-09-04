import { ArgsType, Field, ID, Int } from 'type-graphql'
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { TransactionKind } from '../../enums/transaction-kind.enum'

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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'validations.transaction_description_filter_invalid',
  })
  description?: string

  @Field(() => TransactionKind, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionKind, { message: 'validations.transaction_type_invalid' })
  type?: TransactionKind

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('all', {
    each: true,
    message: 'validations.transaction_category_ids_invalid',
  })
  categoryIds?: string[]

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'validations.transaction_month_invalid' })
  @Max(12, { message: 'validations.transaction_month_invalid' })
  month?: number

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2000, { message: 'validations.transaction_year_invalid' })
  @Max(2100, { message: 'validations.transaction_year_invalid' })
  year?: number
}
