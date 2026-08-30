import 'reflect-metadata'
import { Arg, ID, Mutation, Query, Resolver, Ctx } from 'type-graphql'
import type { GraphQLContext } from '@/context/create-context'
import { requireCurrentUser } from '@/shared/utils'
import { CreateCategoryInput } from '../graphql/input-types/create-category.input'
import { UpdateCategoryInput } from '../graphql/input-types/update-category.input'
import { CreateCategoryValidation } from '../validation/create-category.validation'
import { UpdateCategoryValidation } from '../validation/update-category.validation'
import { CategoryIdValidation } from '../validation/category-id.validation'
import { CreateCategoryUseCase } from '../use-cases/create-category.use-case'
import { ListCategoriesUseCase } from '../use-cases/list-categories.use-case'
import { UpdateCategoryUseCase } from '../use-cases/update-category.use-case'
import { DeleteCategoryUseCase } from '../use-cases/delete-category.use-case'
import { CategoryType } from '../graphql/object-types/category.object-type'
import {
  toCategoryType,
  toUpdateCategoryPatch,
} from '../mappers/category.mapper'

@Resolver()
export class CategoryResolver {
  @Mutation(() => CategoryType)
  async createCategory(
    @Arg('input') input: CreateCategoryInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<CategoryType> {
    const { id: userId } = requireCurrentUser(ctx)
    const validated = await CreateCategoryValidation.validate(input)
    const category = await CreateCategoryUseCase.createCategory({
      userId,
      ...validated,
      description: validated.description ?? null,
    })
    return toCategoryType(category)
  }

  @Query(() => [CategoryType])
  async listCategories(@Ctx() ctx: GraphQLContext): Promise<CategoryType[]> {
    const { id: userId } = requireCurrentUser(ctx)
    const categories = await ListCategoriesUseCase.listCategories(userId)
    return categories.map(toCategoryType)
  }

  @Mutation(() => CategoryType)
  async updateCategory(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateCategoryInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<CategoryType> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await CategoryIdValidation.validate({ id })
    const validated = await UpdateCategoryValidation.validate(input)
    const category = await UpdateCategoryUseCase.updateCategory({
      id: validatedId,
      userId,
      patch: toUpdateCategoryPatch(validated),
    })
    return toCategoryType(category)
  }

  @Mutation(() => Boolean)
  async deleteCategory(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const { id: userId } = requireCurrentUser(ctx)
    const { id: validatedId } = await CategoryIdValidation.validate({ id })
    await DeleteCategoryUseCase.deleteCategory({ id: validatedId, userId })
    return true
  }
}
