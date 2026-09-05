jest.mock('@/modules/transaction/adapters', () => ({
  reassignTransactionsCategoryAdapter: jest.fn(),
}))

import { reassignTransactionsCategoryAdapter } from '@/modules/transaction/adapters'
import { reassignTransactionsCategory } from '../../../gateways/reassign-transactions-category.gateway'

describe('reassignTransactionsCategory gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-007: delegates to the adapter with the same params', async () => {
    ;(reassignTransactionsCategoryAdapter as jest.Mock).mockResolvedValue(
      undefined,
    )

    await reassignTransactionsCategory({
      fromCategoryId: 'cat-1',
      toCategoryId: 'cat-default',
    })

    expect(reassignTransactionsCategoryAdapter).toHaveBeenCalledWith({
      fromCategoryId: 'cat-1',
      toCategoryId: 'cat-default',
    })
  })
})
