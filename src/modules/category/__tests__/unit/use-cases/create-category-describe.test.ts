import 'reflect-metadata'
import { CreateCategoryUseCase } from '../../../use-cases/create-category.use-case'
import { Category } from '../../../entity/category.entity'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    create: jest.fn(),
  },
}))

import { CategoryRepository } from '../../../repository/category.repository'

const validInput = {
  userId: 'user-123',
  title: 'Groceries',
  description: 'Weekly food shopping',
  icon: 'cart',
  color: '#FF00AA',
}

describe('CreateCategoryUseCase.createCategory()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-010: happy path returns the created Category', async () => {
    ;(CategoryRepository.create as jest.Mock).mockImplementation(
      (category: Category) => Promise.resolve(category),
    )

    const result = await CreateCategoryUseCase.createCategory(validInput)

    expect(result).toBeInstanceOf(Category)
    expect(result.title).toBe('Groceries')
    expect(result.userId).toBe('user-123')
    expect(CategoryRepository.create).toHaveBeenCalledTimes(1)
    expect(CategoryRepository.create).toHaveBeenCalledWith(expect.any(Category))
  })
})
