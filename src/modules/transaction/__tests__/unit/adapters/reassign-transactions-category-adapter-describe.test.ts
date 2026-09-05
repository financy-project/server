jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    reassignCategory: jest.fn(),
  },
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { reassignTransactionsCategoryAdapter } from '../../../adapters/reassign-transactions-category.adapter'

describe('reassignTransactionsCategoryAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-005: delegates to TransactionRepository.reassignCategory with fromCategoryId/toCategoryId', async () => {
    ;(TransactionRepository.reassignCategory as jest.Mock).mockResolvedValue(
      undefined,
    )

    await reassignTransactionsCategoryAdapter({
      fromCategoryId: 'cat-1',
      toCategoryId: 'cat-default',
    })

    expect(TransactionRepository.reassignCategory).toHaveBeenCalledWith(
      'cat-1',
      'cat-default',
    )
  })
})
