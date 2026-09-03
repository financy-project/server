import { Field, ID, InputType, Int } from 'type-graphql'
import { IsDate, IsEnum, IsInt, IsUUID, Length, Min } from 'class-validator'
import { TransactionKind } from '../../enums/transaction-kind.enum'

@InputType()
export class CreateTransactionInput {
  @Field(() => TransactionKind)
  @IsEnum(TransactionKind, {
    message: 'validations.transaction_type_invalid',
  })
  type!: TransactionKind

  @Field()
  @Length(1, 500, {
    message: 'validations.transaction_description_required',
  })
  description!: string

  @Field(() => Date)
  @IsDate({ message: 'validations.transaction_date_invalid' })
  date!: Date

  @Field(() => Int)
  @IsInt({ message: 'validations.transaction_value_integer' })
  @Min(1, { message: 'validations.transaction_value_positive' })
  value!: number

  @Field(() => ID)
  @IsUUID('all', { message: 'validations.transaction_category_id_invalid' })
  categoryId!: string
}
