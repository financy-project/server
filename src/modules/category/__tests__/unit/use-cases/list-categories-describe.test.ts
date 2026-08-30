import 'reflect-metadata'
import { ListCategoriesUseCase } from '../../../use-cases/list-categories.use-case'
import { Category } from '../../../entity/category.entity'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    findAllByUserId: jest.fn(),
  },
}))

import { CategoryRepository } from '../../../repository/category.repository'

describe('ListCategoriesUseCase.listCategories()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("T-011: returns the repository's result for the given userId", async () => {
    const categories = [
      Category.fromRepository({
        id: 'cat-1',
        userId: 'user-123',
        title: 'Groceries',
        description: null,
        icon: 'cart',
        color: '#FF00AA',
      }),
    ]
    ;(CategoryRepository.findAllByUserId as jest.Mock).mockResolvedValue(
      categories,
    )

    const result = await ListCategoriesUseCase.listCategories('user-123')

    expect(result).toBe(categories)
    expect(CategoryRepository.findAllByUserId).toHaveBeenCalledWith('user-123')
    expect(CategoryRepository.findAllByUserId).toHaveBeenCalledTimes(1)
  })
})
