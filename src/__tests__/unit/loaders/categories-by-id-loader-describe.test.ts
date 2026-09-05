jest.mock('@/repositories/category.repository', () => ({
  CategoryRepository: {
    findManyByIds: jest.fn(),
  },
}))

import { CategoryRepository } from '@/repositories/category.repository'
import { buildCategoriesByIdLoader } from '@/loaders/categories-by-id.loader'

describe('categoriesById loader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-019: batches multiple .load() calls into a single repository call', async () => {
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', title: 'Groceries', color: '#FFF' },
      { id: 'cat-2', userId: 'user-1', title: 'Rent', color: '#000' },
    ])
    const loader = buildCategoriesByIdLoader()

    await Promise.all([loader.load('cat-1'), loader.load('cat-2')])

    expect(CategoryRepository.findManyByIds).toHaveBeenCalledTimes(1)
    expect(CategoryRepository.findManyByIds).toHaveBeenCalledWith([
      'cat-1',
      'cat-2',
    ])
  })

  it('T-019: returns results in input-key order', async () => {
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([
      { id: 'cat-2', userId: 'user-1', title: 'Rent', color: '#000' },
      { id: 'cat-1', userId: 'user-1', title: 'Groceries', color: '#FFF' },
    ])
    const loader = buildCategoriesByIdLoader()

    const [first, second] = await Promise.all([
      loader.load('cat-1'),
      loader.load('cat-2'),
    ])

    expect(first?.id).toBe('cat-1')
    expect(second?.id).toBe('cat-2')
  })

  it('T-019: returns null for an id the repository did not return', async () => {
    ;(CategoryRepository.findManyByIds as jest.Mock).mockResolvedValue([])
    const loader = buildCategoriesByIdLoader()

    const result = await loader.load('missing-cat')

    expect(result).toBeNull()
  })
})
