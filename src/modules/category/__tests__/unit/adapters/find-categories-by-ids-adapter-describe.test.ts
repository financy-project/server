import { Category } from '../../../entity/category.entity'

jest.mock('../../../repository/category.repository', () => ({
  CategoryRepository: {
    findManyByIds: jest.fn(),
  },
}))

import { CategoryRepository } from '../../../repository/category.repository'
import { findCategoriesByIdsAdapter } from '../../../adapters/find-categories-by-ids.adapter'

describe('findCategoriesByIdsAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-013: maps CategoryRepository.findManyByIds results to CategoryDTO[]', async () => {
    const categories = [
      Category.fromRepository({
        id: 'cat-1',
        userId: 'user-1',
        title: 'Groceries',
        description: 'Food',
        icon: 'cart',
        color: '#FF00AA',
      }),
      Category.fromRepository({
        id: 'cat-2',
        userId: 'user-2',
        title: 'Rent',
        description: null,
        icon: 'home',
        color: '#00FF00',
      }),
    ]
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue(
      categories,
    )

    const result = await findCategoriesByIdsAdapter(['cat-1', 'cat-2'])

    expect(CategoryRepository.findManyByIds).toHaveBeenCalledWith([
      'cat-1',
      'cat-2',
    ])
    expect(result).toEqual([
      { id: 'cat-1', userId: 'user-1', title: 'Groceries', color: '#FF00AA' },
      { id: 'cat-2', userId: 'user-2', title: 'Rent', color: '#00FF00' },
    ])
  })
})
