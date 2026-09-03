import { Category } from '../entity/category.entity'
import { CategoryRepository } from '../repository/category.repository'

const listCategories = (userId: string): Promise<Category[]> =>
  CategoryRepository.findAllByUserId(userId)

export const ListCategoriesUseCase = {
  listCategories,
}
