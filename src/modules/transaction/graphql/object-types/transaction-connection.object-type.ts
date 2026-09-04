import { Field, Int, ObjectType } from 'type-graphql'
import { PageInfo } from '@/shared/graphql/object-types'
import { TransactionType } from './transaction.object-type'

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
