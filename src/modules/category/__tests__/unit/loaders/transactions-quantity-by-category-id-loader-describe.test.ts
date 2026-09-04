jest.mock(
  '../../../gateways/count-transactions-by-category-ids.gateway',
  () => ({
    countTransactionsByCategoryIds: jest.fn(),
  }),
)

import { countTransactionsByCategoryIds } from '../../../gateways/count-transactions-by-category-ids.gateway'
import { buildTransactionsQuantityByCategoryIdLoader } from '../../../loaders/transactions-quantity-by-category-id.loader'

describe('transactionsQuantityByCategoryId loader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-007: resolves the correct count per id', async () => {
    ;(countTransactionsByCategoryIds as jest.Mock).mockResolvedValue({
      'cat-1': 3,
      'cat-2': 1,
    })
    const loader = buildTransactionsQuantityByCategoryIdLoader()

    const [first, second] = await Promise.all([
      loader.load('cat-1'),
      loader.load('cat-2'),
    ])

    expect(first).toBe(3)
    expect(second).toBe(1)
  })

  it('T-008: defaults to 0 for an id absent from the gateway result map', async () => {
    ;(countTransactionsByCategoryIds as jest.Mock).mockResolvedValue({})
    const loader = buildTransactionsQuantityByCategoryIdLoader()

    const result = await loader.load('cat-missing')

    expect(result).toBe(0)
  })

  it('T-009: preserves 1:1 input/output order', async () => {
    ;(countTransactionsByCategoryIds as jest.Mock).mockResolvedValue({
      'cat-2': 1,
    })
    const loader = buildTransactionsQuantityByCategoryIdLoader()

    const [first, second] = await Promise.all([
      loader.load('cat-1'),
      loader.load('cat-2'),
    ])

    expect(first).toBe(0)
    expect(second).toBe(1)
  })
})
