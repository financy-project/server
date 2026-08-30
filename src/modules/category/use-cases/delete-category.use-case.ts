import { CategoryNotFoundError } from '../errors/category-errors'
import { CategoryRepository } from '../repository/category.repository'

type DeleteCategoryInput = {
  id: string
  userId: string
}

const deleteCategory = async (input: DeleteCategoryInput): Promise<void> => {
  const { id, userId } = input
  const category = await CategoryRepository.findById(id)

  if (!category.belongsTo(userId)) {
    throw new CategoryNotFoundError()
  }

  await CategoryRepository.remove(id)
}

export const DeleteCategoryUseCase = {
  deleteCategory,
}
