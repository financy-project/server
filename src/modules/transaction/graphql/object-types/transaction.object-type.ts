import { Field, ID, Int, ObjectType, registerEnumType } from 'type-graphql'
import { TransactionKind } from '../../enums/transaction-kind.enum'
import { TransactionCategoryType } from './transaction-category.object-type'

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
  // plain mapped field.
  @Field(() => TransactionCategoryType, { nullable: true })
  category?: TransactionCategoryType | null

  // Plain (non-@Field) property set by the mapper so the `category`
  // @FieldResolver has something to key the loader on without re-fetching
  // the Transaction row.
  categoryId!: string | null
}
