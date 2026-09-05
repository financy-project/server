import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from 'type-graphql'
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'
import {
  TransactionKind,
  type Transaction,
  type UpdateTransactionPatch,
} from '@/entities/transaction.entity'
import { ValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'
import { PageInfo } from '@/shared/graphql/object-types'
import { encodeCursor } from '@/shared/utils/cursor'
import { CategoryType } from './category.types'

registerEnumType(TransactionKind, { name: 'TransactionKind' })

@ObjectType()
export class TransactionType {
  @Field(() => ID)
  id!: string

  @Field(() => TransactionKind)
  type!: TransactionKind

  @Field()
  description!: string

  @Field(() => Date)
  date!: Date

  @Field(() => Int)
  value!: number

  // Resolved via @FieldResolver on TransactionResolver (DataLoader), not a
  // plain mapped field. Reuses CategoryType directly — no separate
  // "transaction category" GraphQL shape now that there's no module
  // boundary to keep it isolated from.
  @Field(() => CategoryType, { nullable: true })
  category?: CategoryType | null

  // Plain (non-@Field) property set by the mapper so the `category`
  // @FieldResolver has something to key the loader on without re-fetching
  // the Transaction row.
  categoryId!: string | null
}

export const toTransactionType = (
  transaction: Transaction,
): TransactionType => {
  const type = new TransactionType()
  type.id = transaction.id
  type.type = transaction.type
  type.description = transaction.description
  type.date = transaction.date
  type.value = transaction.value
  type.categoryId = transaction.categoryId
  return type
}

@ObjectType()
export class TransactionEdge {
  @Field(() => TransactionType)
  node!: TransactionType

  @Field()
  cursor!: string
}

@ObjectType()
export class TransactionConnection {
  @Field(() => [TransactionEdge])
  edges!: TransactionEdge[]

  @Field(() => PageInfo)
  pageInfo!: PageInfo

  @Field(() => Int)
  totalRecord!: number
}

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

export const toUpdateTransactionPatch = (
  input: UpdateTransactionInput,
): UpdateTransactionPatch => {
  const patch: UpdateTransactionPatch = {}
  if (input.type !== undefined) patch.type = input.type
  if (input.description !== undefined) patch.description = input.description
  if (input.date !== undefined) patch.date = input.date
  if (input.value !== undefined) patch.value = input.value
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  return patch
}

type PaginatedTransactions = {
  items: Transaction[]
  hasNextPage: boolean
  endCursor: string | null
  totalRecord: number
}

export const toTransactionConnection = (
  result: PaginatedTransactions,
): TransactionConnection => {
  const connection = new TransactionConnection()
  connection.edges = result.items.map((transaction) => {
    const edge = new TransactionEdge()
    edge.node = toTransactionType(transaction)
    edge.cursor = encodeCursor({ date: transaction.date, id: transaction.id })
    return edge
  })
  connection.pageInfo = {
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor,
  }
  connection.totalRecord = result.totalRecord
  return connection
}

// Plain validateInput() DTO, not a bound GraphQL @ArgsType — mirrors
// CategoryIdArgs exactly (see category.types.ts).
export class TransactionIdArgs {
  @IsUUID('all', { message: 'validations.transaction_id_invalid' })
  id!: string
}

// Real @ArgsType() (unlike TransactionIdArgs) since listTransactions has
// multiple independent optional parameters. Cross-field checks live in
// validateListTransactionsArgs below, not here — class-validator decorators
// only validate each field in isolation.
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

const throwFieldError = (path: string, messageKey: string): never => {
  throw new ValidationError(messageKey, {
    errors: [{ path, message: I18nService.translate(messageKey) }],
  })
}

// Cross-field rules that plain class-validator decorators can't express on
// ListTransactionsArgs (each field only validates itself in isolation).
export const validateListTransactionsArgs = (
  args: ListTransactionsArgs,
): ListTransactionsArgs => {
  const hasStartDate = args.startDate !== undefined
  const hasEndDate = args.endDate !== undefined
  const hasMonth = args.month !== undefined
  const hasYear = args.year !== undefined

  if (hasMonth !== hasYear) {
    throwFieldError(
      hasMonth ? 'year' : 'month',
      'validations.transaction_period_incomplete',
    )
  }

  if (hasMonth && hasYear && (hasStartDate || hasEndDate)) {
    throwFieldError(
      'month',
      'validations.transaction_period_conflicts_with_date_range',
    )
  }

  if (hasStartDate !== hasEndDate) {
    throwFieldError(
      hasStartDate ? 'endDate' : 'startDate',
      'validations.transaction_date_range_incomplete',
    )
  }

  if (hasStartDate && hasEndDate && args.endDate! < args.startDate!) {
    throwFieldError('endDate', 'validations.transaction_date_range_invalid')
  }

  return args
}
