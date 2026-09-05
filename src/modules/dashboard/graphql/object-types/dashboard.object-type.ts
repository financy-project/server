import { Field, ObjectType } from 'type-graphql'
import { TransactionType } from '@/modules/transaction/graphql/object-types/transaction.object-type'
import { DashboardMovementType } from './dashboard-movement.object-type'
import { DashboardCategoryBalanceType } from './dashboard-category-balance.object-type'

// TransactionType is deep-imported rather than pulled from the transaction
// module's barrel — same precedent as auth.mapper.ts/auth.resolver.ts
// deep-importing UserType from the 'user' module: reusing another module's
// GraphQL shape for a field this module only assembles, never resolves the
// underlying logic for.
@ObjectType()
export class DashboardType {
  @Field(() => DashboardMovementType)
  movement!: DashboardMovementType

  @Field(() => [TransactionType], { complexity: 3 })
  recentTransactions!: TransactionType[]

  @Field(() => [DashboardCategoryBalanceType], { complexity: 5 })
  balanceByCategory!: DashboardCategoryBalanceType[]
}
