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
import { requireCurrentUser, validateInput } from '@/shared/utils'
import { getMonthRange } from '@/shared/utils/date-range'
import {
  Transaction,
  TransactionCategoryNotFoundError,
  TransactionNotFoundError,
} from '@/entities/transaction.entity'
import { CategoryRepository } from '@/repositories/category.repository'
import { TransactionRepository } from '@/repositories/transaction.repository'
import { CategoryType, toCategoryType } from '@/graphql/category.types'
import {
  TransactionType,
  TransactionConnection,
  TransactionIdArgs,
  ListTransactionsArgs,
  CreateTransactionInput,
  UpdateTransactionInput,
  toTransactionType,
  toTransactionConnection,
  toUpdateTransactionPatch,
  validateListTransactionsArgs,
} from '@/graphql/transaction.types'

@Resolver(() => TransactionType)
export class TransactionResolver {
  @Mutation(() => TransactionType)
  async createTransaction(
    @Arg('input') input: CreateTransactionInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionType> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = await validateInput(CreateTransactionInput, input)

    const [category] = await CategoryRepository.findManyByIds([
      validated.categoryId,
    ])
    if (!category || category.userId !== userId) {
      throw new TransactionCategoryNotFoundError()
    }

    const transaction = await TransactionRepository.create(
      Transaction.create({ userId, ...validated }),
    )
    return toTransactionType(transaction)
  }

  @Query(() => TransactionConnection, { complexity: 12 })
  async listTransactions(
    @Args() args: ListTransactionsArgs,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionConnection> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = validateListTransactionsArgs(
      await validateInput(ListTransactionsArgs, args),
    )

    const { startDate, endDate } =
      validated.month && validated.year
        ? getMonthRange(validated.year, validated.month)
        : {
            startDate: validated.startDate ?? null,
            endDate: validated.endDate ?? null,
          }

    const result = await TransactionRepository.findAllByUserId(
      userId,
      {
        startDate,
        endDate,
        description: validated.description ?? null,
        type: validated.type ?? null,
        categoryIds: validated.categoryIds ?? null,
      },
      { first: validated.first ?? 20, after: validated.after ?? null },
    )

    return toTransactionConnection(result)
  }

  @Mutation(() => TransactionType)
  async updateTransaction(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateTransactionInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<TransactionType> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await validateInput(TransactionIdArgs, { id })
    const validated = await validateInput(UpdateTransactionInput, input)

    const transaction = await TransactionRepository.findById(validatedId)
    if (!transaction.belongsTo(userId)) {
      throw new TransactionNotFoundError()
    }

    const patch = toUpdateTransactionPatch(validated)
    if (patch.categoryId !== undefined && patch.categoryId !== null) {
      const [category] = await CategoryRepository.findManyByIds([
        patch.categoryId,
      ])
      if (!category || category.userId !== userId) {
        throw new TransactionCategoryNotFoundError()
      }
    }

    const updated = await TransactionRepository.update(validatedId, patch)
    return toTransactionType(updated)
  }

  @Mutation(() => Boolean)
  async deleteTransaction(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await validateInput(TransactionIdArgs, { id })
    const transaction = await TransactionRepository.findById(validatedId)

    if (!transaction.belongsTo(userId)) {
      throw new TransactionNotFoundError()
    }

    await TransactionRepository.remove(validatedId)
    return true
  }

  @FieldResolver(() => CategoryType, { nullable: true, complexity: 2 })
  async category(
    @Root() transaction: TransactionType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<CategoryType | null> {
    if (!transaction.categoryId) return null

    const category = await ctx.loaders.categoriesById.load(
      transaction.categoryId,
    )
    return category ? toCategoryType(category) : null
  }
}
