import { Field, ID, InputType, Int } from 'type-graphql'
import {
  IsDate,
  IsEnum,
  IsInt,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator'
import { TransactionKind } from '../../enums/transaction-kind.enum'

// All fields optional (partial update). No way to send an explicit `null`
// for categoryId — clearing it only happens via category deletion
// (onDelete: SetNull), never through this mutation. ValidateIf only skips
// validation when the field is fully omitted; an explicitly-sent
// empty/invalid value still fails.
@InputType()
export class UpdateTransactionInput {
  @Field(() => TransactionKind, { nullable: true })
  @ValidateIf((input: UpdateTransactionInput) => input.type !== undefined)
  @IsEnum(TransactionKind, {
    message: 'validations.transaction_type_invalid',
  })
  type?: TransactionKind

  @Field({ nullable: true })
  @ValidateIf(
    (input: UpdateTransactionInput) => input.description !== undefined,
  )
  @Length(1, 500, {
    message: 'validations.transaction_description_required',
  })
  description?: string

  @Field(() => Date, { nullable: true })
  @ValidateIf((input: UpdateTransactionInput) => input.date !== undefined)
  @IsDate({ message: 'validations.transaction_date_invalid' })
  date?: Date

  @Field(() => Int, { nullable: true })
  @ValidateIf((input: UpdateTransactionInput) => input.value !== undefined)
  @IsInt({ message: 'validations.transaction_value_integer' })
  @Min(1, { message: 'validations.transaction_value_positive' })
  value?: number

  @Field(() => ID, { nullable: true })
  @ValidateIf((input: UpdateTransactionInput) => input.categoryId !== undefined)
  @IsUUID('all', { message: 'validations.transaction_category_id_invalid' })
  categoryId?: string
}
