jest.mock('@/modules/category/adapters', () => ({
  findCategoriesByIdsAdapter: jest.fn(),
}))

import { findCategoriesByIdsAdapter } from '@/modules/category/adapters'
import { findCategoriesByIds } from '../../../gateways/find-categories-by-ids.gateway'

describe('findCategoriesByIds gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-014: dedupes ids before calling the adapter', async () => {
    ;(findCategoriesByIdsAdapter as jest.Mock).mockResolvedValue([])

    await findCategoriesByIds(['cat-1', 'cat-2', 'cat-1'])

    expect(findCategoriesByIdsAdapter).toHaveBeenCalledTimes(1)
    expect(findCategoriesByIdsAdapter).toHaveBeenCalledWith(['cat-1', 'cat-2'])
  })

  it('T-014: returns [] for an empty array without calling the adapter', async () => {
    const result = await findCategoriesByIds([])

    expect(result).toEqual([])
    expect(findCategoriesByIdsAdapter).not.toHaveBeenCalled()
  })
})
