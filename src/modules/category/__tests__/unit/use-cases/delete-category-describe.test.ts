import 'reflect-metadata'
import { DeleteCategoryUseCase } from '../../../use-cases/delete-category.use-case'
import { CategoryNotFoundError } from '../../../errors/category-errors'
import { Category } from '../../../entity/category.entity'
import {
  DEFAULT_CATEGORY_TITLE,
  DEFAULT_CATEGORY_ICON,
  DEFAULT_CATEGORY_COLOR,
} from '@/utils/constants'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    findById: jest.fn(),
    remove: jest.fn(),
    upsertByUserIdAndTitle: jest.fn(),
  },
}))
jest.mock('../../../gateways/reassign-transactions-category.gateway', () => ({
  reassignTransactionsCategory: jest.fn(),
}))

import { CategoryRepository } from '../../../repository/category.repository'
import { reassignTransactionsCategory } from '../../../gateways/reassign-transactions-category.gateway'

const ownedCategory = Category.fromRepository({
  id: 'cat-1',
  userId: 'user-123',
  title: 'Groceries',
  description: null,
  icon: 'cart',
  color: '#FF00AA',
})

const defaultCategory = Category.fromRepository({
  id: 'cat-default',
  userId: 'user-123',
  title: DEFAULT_CATEGORY_TITLE,
  description: null,
  icon: DEFAULT_CATEGORY_ICON,
  color: DEFAULT_CATEGORY_COLOR,
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

  it('T-013: when found and owned, ensures the default "Outros" category, reassigns its transactions, then calls remove(id)', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(ownedCategory)
    ;(CategoryRepository.upsertByUserIdAndTitle as jest.Mock).mockResolvedValue(
      defaultCategory,
    )
    ;(reassignTransactionsCategory as jest.Mock).mockResolvedValue(undefined)
    ;(CategoryRepository.remove as jest.Mock).mockResolvedValue(undefined)

    await DeleteCategoryUseCase.deleteCategory({
      id: 'cat-1',
      userId: 'user-123',
    })

    expect(CategoryRepository.upsertByUserIdAndTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        title: DEFAULT_CATEGORY_TITLE,
        icon: DEFAULT_CATEGORY_ICON,
        color: DEFAULT_CATEGORY_COLOR,
      }),
    )
    expect(reassignTransactionsCategory).toHaveBeenCalledWith({
      fromCategoryId: 'cat-1',
      toCategoryId: 'cat-default',
    })
    expect(CategoryRepository.remove).toHaveBeenCalledWith('cat-1')
  })

  it('T-014: deleting the default "Outros" category itself skips reassignment and just removes it', async () => {
    ;(CategoryRepository.findById as jest.Mock).mockResolvedValue(
      defaultCategory,
    )
    ;(CategoryRepository.remove as jest.Mock).mockResolvedValue(undefined)

    await DeleteCategoryUseCase.deleteCategory({
      id: 'cat-default',
      userId: 'user-123',
    })

    expect(CategoryRepository.upsertByUserIdAndTitle).not.toHaveBeenCalled()
    expect(reassignTransactionsCategory).not.toHaveBeenCalled()
    expect(CategoryRepository.remove).toHaveBeenCalledWith('cat-default')
  })
})
