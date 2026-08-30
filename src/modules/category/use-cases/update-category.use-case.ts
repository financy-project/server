import { Category, type UpdateCategoryPatch } from '../entity/category.entity'
import { CategoryNotFoundError } from '../errors/category-errors'
import { CategoryRepository } from '../repository/category.repository'

type UpdateCategoryInput = {
  id: string
  userId: string
  patch: UpdateCategoryPatch
}

const updateCategory = async (
  input: UpdateCategoryInput,
): Promise<Category> => {
  const { id, userId, patch } = input
  const category = await CategoryRepository.findById(id)

  if (!category.belongsTo(userId)) {
    throw new CategoryNotFoundError()
  }

  return CategoryRepository.update(id, patch)
}

export const UpdateCategoryUseCase = {
  updateCategory,
}
