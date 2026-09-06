import 'reflect-metadata'
import {
  Arg,
  Ctx,
  FieldResolver,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql'
import type { GraphQLContext } from '@/context/create-context'
import { requireCurrentUser, validateInput } from '@/shared/utils'
import {
  Category,
  CategoryNotFoundError,
  CannotDeleteDefaultCategoryError,
} from '@/entities/category.entity'
import { CategoryRepository } from '@/repositories/category.repository'
import { TransactionRepository } from '@/repositories/transaction.repository'
import {
  DEFAULT_CATEGORY_TITLE,
  DEFAULT_CATEGORY_ICON,
  DEFAULT_CATEGORY_COLOR,
} from '@/utils/constants'
import {
  CategoryType,
  CategoryIdArgs,
  CreateCategoryInput,
  UpdateCategoryInput,
  toCategoryType,
  toUpdateCategoryPatch,
} from '@/graphql/category.types'

@Resolver(() => CategoryType)
export class CategoryResolver {
  @Mutation(() => CategoryType)
  async createCategory(
    @Arg('input') input: CreateCategoryInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<CategoryType> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = await validateInput(CreateCategoryInput, input)
    const category = await CategoryRepository.create(
      Category.create({
        userId,
        ...validated,
        description: validated.description ?? null,
      }),
    )
    return toCategoryType(category)
  }

  @Query(() => [CategoryType])
  async listCategories(@Ctx() ctx: GraphQLContext): Promise<CategoryType[]> {
    const { id: userId } = requireCurrentUser(ctx)
    const categories = await CategoryRepository.findAllByUserId(userId)
    return categories.map(toCategoryType)
  }

  @Mutation(() => CategoryType)
  async updateCategory(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateCategoryInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<CategoryType> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await validateInput(CategoryIdArgs, { id })
    const validated = await validateInput(UpdateCategoryInput, input)
    const category = await CategoryRepository.findById(validatedId)

    if (!category.belongsTo(userId)) {
      throw new CategoryNotFoundError()
    }

    const updated = await CategoryRepository.update(
      validatedId,
      toUpdateCategoryPatch(validated),
    )
    return toCategoryType(updated)
  }

  @Mutation(() => Boolean)
  async deleteCategory(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await validateInput(CategoryIdArgs, { id })
    const category = await CategoryRepository.findById(validatedId)

    if (!category.belongsTo(userId)) {
      throw new CategoryNotFoundError()
    }

    if (category.title === DEFAULT_CATEGORY_TITLE) {
      throw new CannotDeleteDefaultCategoryError()
    }

    const defaultCategory = await CategoryRepository.upsertByUserIdAndTitle(
      Category.create({
        userId,
        title: DEFAULT_CATEGORY_TITLE,
        description: null,
        icon: DEFAULT_CATEGORY_ICON,
        color: DEFAULT_CATEGORY_COLOR,
      }),
    )

    await TransactionRepository.reassignCategory(
      category.id,
      defaultCategory.id,
    )

    await CategoryRepository.remove(validatedId)
    return true
  }

  @FieldResolver(() => Int)
  async transactionsQuantity(
    @Root() category: CategoryType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<number> {
    return ctx.loaders.transactionsQuantityByCategoryId.load(category.id)
  }
}
