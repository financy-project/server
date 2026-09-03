jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    countByCategoryIds: jest.fn(),
  },
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { countTransactionsByCategoryIdsAdapter } from '../../../adapters/count-transactions-by-category-ids.adapter'

describe('countTransactionsByCategoryIdsAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-004: delegates to TransactionRepository.countByCategoryIds and returns its result unchanged', async () => {
    const counts = { 'cat-1': 2, 'cat-2': 1 }
    ;(TransactionRepository.countByCategoryIds as jest.Mock).mockResolvedValue(
      counts,
    )

    const result = await countTransactionsByCategoryIdsAdapter([
      'cat-1',
      'cat-2',
    ])

    expect(TransactionRepository.countByCategoryIds).toHaveBeenCalledWith([
      'cat-1',
      'cat-2',
    ])
    expect(result).toBe(counts)
  })
})
