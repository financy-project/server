import 'reflect-metadata'
import { DeleteCategoryUseCase } from '../../../use-cases/delete-category.use-case'
import { CategoryNotFoundError } from '../../../errors/category-errors'
import { Category } from '../../../entity/category.entity'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    findById: jest.fn(),
    remove: jest.fn(),
  },
}))

import { CategoryRepository } from '../../../repository/category.repository'

const ownedCategory = Category.fromRepository({
  id: 'cat-1',
  userId: 'user-123',
  title: 'Groceries',
  description: null,
  icon: 'cart',
  color: '#FF00AA',
})

describe('DeleteCategoryUseCase.deleteCategory()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-012: propagates CategoryNotFoundError when findById throws (not found)', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockRejectedValue(
      new CategoryNotFoundError(),
    )

    await expect(
      DeleteCategoryUseCase.deleteCategory({
        id: 'cat-1',
        userId: 'user-123',
      }),
    ).rejects.toThrow(CategoryNotFoundError)

    expect(CategoryRepository.remove).not.toHaveBeenCalled()
  })

  it('T-012: throws CategoryNotFoundError when found but not owned by userId, without calling remove', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(ownedCategory)

    await expect(
      DeleteCategoryUseCase.deleteCategory({
        id: 'cat-1',
        userId: 'someone-else',
      }),
    ).rejects.toThrow(CategoryNotFoundError)

    expect(CategoryRepository.remove).not.toHaveBeenCalled()
  })

  it('T-012: when found and owned, calls CategoryRepository.remove(id)', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(ownedCategory)
    ;(CategoryRepository.remove as jest.Mock).mockResolvedValue(undefined)

    await DeleteCategoryUseCase.deleteCategory({
      id: 'cat-1',
      userId: 'user-123',
    })

    expect(CategoryRepository.remove).toHaveBeenCalledWith('cat-1')
  })
})
