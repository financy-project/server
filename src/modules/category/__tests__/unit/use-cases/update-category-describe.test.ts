import 'reflect-metadata'
import { UpdateCategoryUseCase } from '../../../use-cases/update-category.use-case'
import { CategoryNotFoundError } from '../../../errors/category-errors'
import { Category } from '../../../entity/category.entity'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    findById: jest.fn(),
    update: jest.fn(),
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

describe('UpdateCategoryUseCase.updateCategory()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-012: propagates CategoryNotFoundError when findById throws (not found)', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockRejectedValue(
      new CategoryNotFoundError(),
    )

    await expect(
      UpdateCategoryUseCase.updateCategory({
        id: 'cat-1',
        userId: 'user-123',
        patch: { title: 'New Title' },
      }),
    ).rejects.toThrow(CategoryNotFoundError)

    expect(CategoryRepository.update).not.toHaveBeenCalled()
  })

  it('T-012: throws CategoryNotFoundError when found but not owned by userId, without calling update', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(ownedCategory)

    await expect(
      UpdateCategoryUseCase.updateCategory({
        id: 'cat-1',
        userId: 'someone-else',
        patch: { title: 'New Title' },
      }),
    ).rejects.toThrow(CategoryNotFoundError)

    expect(CategoryRepository.update).not.toHaveBeenCalled()
  })

  it('T-012: when found and owned, calls CategoryRepository.update(id, patch) and returns its result', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(ownedCategory)
    const updated = Category.fromRepository({
      ...ownedCategory,
      title: 'New Title',
    })
    ;(CategoryRepository.update as jest.Mock).mockResolvedValue(updated)

    const patch = { title: 'New Title' }
    const result = await UpdateCategoryUseCase.updateCategory({
      id: 'cat-1',
      userId: 'user-123',
      patch,
    })

    expect(CategoryRepository.update).toHaveBeenCalledWith('cat-1', patch)
    expect(result).toBe(updated)
  })
})
