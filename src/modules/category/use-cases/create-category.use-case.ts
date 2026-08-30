import { Category, type CreateCategoryProps } from '../entity/category.entity'
import { CategoryRepository } from '../repository/category.repository'

const createCategory = async (
  input: CreateCategoryProps,
): Promise<Category> => {
  const category = Category.create(input)
  return CategoryRepository.create(category)
}

export const CreateCategoryUseCase = {
  createCategory,
}
