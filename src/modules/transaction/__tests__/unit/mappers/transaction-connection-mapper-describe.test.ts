import 'reflect-metadata'
import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'
import { toTransactionConnection } from '../../../mappers/transaction-connection.mapper'

describe('toTransactionConnection', () => {
  it('T-006: maps totalRecord unchanged from the input result alongside edges/pageInfo', () => {
    const items = [
      Transaction.fromRepository({
        id: 'txn-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date('2026-09-01T00:00:00.000Z'),
        value: 5000,
      }),
    ]

    const result = toTransactionConnection({
      items,
      hasNextPage: true,
      endCursor: 'cursor-1',
      totalRecord: 42,
    })

    expect(result.totalRecord).toBe(42)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]?.node.id).toBe('txn-1')
    expect(result.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: 'cursor-1',
    })
  })
})
