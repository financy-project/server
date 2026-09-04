jest.mock('@/modules/transaction/adapters', () => ({
  countTransactionsByCategoryIdsAdapter: jest.fn(),
}))

import { countTransactionsByCategoryIdsAdapter } from '@/modules/transaction/adapters'
import { countTransactionsByCategoryIds } from '../../../gateways/count-transactions-by-category-ids.gateway'

describe('countTransactionsByCategoryIds gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-005: dedupes ids before calling the adapter', async () => {
    ;(countTransactionsByCategoryIdsAdapter as jest.Mock).mockResolvedValue({})

    await countTransactionsByCategoryIds(['cat-1', 'cat-2', 'cat-1'])

    expect(countTransactionsByCategoryIdsAdapter).toHaveBeenCalledTimes(1)
    expect(countTransactionsByCategoryIdsAdapter).toHaveBeenCalledWith([
      'cat-1',
      'cat-2',
    ])
  })

  it('T-006: returns {} for an empty array without calling the adapter', async () => {
    const result = await countTransactionsByCategoryIds([])

    expect(result).toEqual({})
    expect(countTransactionsByCategoryIdsAdapter).not.toHaveBeenCalled()
  })
})
