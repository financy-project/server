import 'reflect-metadata'
import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql'
import type { GraphQLContext } from '@/context/create-context'
import { requireCurrentUser } from '@/shared/utils'
import {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../graphql/input-types'
import { ListTransactionsArgs } from '../graphql/args'
import {
  CreateTransactionValidation,
  UpdateTransactionValidation,
  TransactionIdValidation,
  ListTransactionsValidation,
} from '../validation'
import {
  CreateTransactionUseCase,
  ListTransactionsUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase,
} from '../use-cases'
import {
  TransactionType,
  TransactionCategoryType,
  TransactionConnection,
} from '../graphql/object-types'
import {
  toTransactionType,
  toTransactionCategoryType,
  toUpdateTransactionPatch,
  toTransactionConnection,
} from '../mappers'

@Resolver(() => TransactionType)
export class TransactionResolver {
  @Mutation(() => TransactionType)
  async createTransaction(
    @Arg('input') input: CreateTransactionInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionType> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = await CreateTransactionValidation.validate(input)
    const transaction = await CreateTransactionUseCase.createTransaction({
      userId,
      ...validated,
    })
    return toTransactionType(transaction)
  }

  @Query(() => TransactionConnection, { complexity: 10 })
  async listTransactions(
    @Args() args: ListTransactionsArgs,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionConnection> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = await ListTransactionsValidation.validate(args)
    const result = await ListTransactionsUseCase.listTransactions({
      userId,
      startDate: validated.startDate ?? null,
      endDate: validated.endDate ?? null,
      first: validated.first ?? 20,
      after: validated.after ?? null,
    })

    return toTransactionConnection(result)
  }

  @Mutation(() => TransactionType)
  async updateTransaction(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateTransactionInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionType> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await TransactionIdValidation.validate({ id })
    const validated = await UpdateTransactionValidation.validate(input)
    const transaction = await UpdateTransactionUseCase.updateTransaction({
      id: validatedId,
      userId,
      patch: toUpdateTransactionPatch(validated),
    })
    return toTransactionType(transaction)
  }

  @Mutation(() => Boolean)
  async deleteTransaction(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await TransactionIdValidation.validate({ id })
    await DeleteTransactionUseCase.deleteTransaction({
      id: validatedId,
      userId,
    })
    return true
  }

  @FieldResolver(() => TransactionCategoryType, {
    nullable: true,
    complexity: 2,
  })
  async category(
    @Root() transaction: TransactionType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionCategoryType | null> {
    if (!transaction.categoryId) return null

    const category = await ctx.loaders.categoriesById.load(
      transaction.categoryId,
    )
    return category ? toTransactionCategoryType(category) : null
  }
}
