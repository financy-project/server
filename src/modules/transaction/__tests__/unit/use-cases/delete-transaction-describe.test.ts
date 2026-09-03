import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'
import { TransactionNotFoundError } from '../../../errors/transaction-errors'

jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    findById: jest.fn(),
    remove: jest.fn(),
  },
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { DeleteTransactionUseCase } from '../../../use-cases/delete-transaction.use-case'

const ownedTransaction = Transaction.fromRepository({
  id: 'txn-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  type: TransactionKind.EXPENSE,
  description: 'Groceries',
  date: new Date('2026-09-01T00:00:00.000Z'),
  value: 5000,
})

describe('DeleteTransactionUseCase.deleteTransaction()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-017: propagates TransactionNotFoundError when findById throws (not found)', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockRejectedValue(
      new TransactionNotFoundError(),
    )

    await expect(
      DeleteTransactionUseCase.deleteTransaction({
        id: 'txn-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow(TransactionNotFoundError)

    expect(TransactionRepository.remove).not.toHaveBeenCalled()
  })

  it('T-017: throws TransactionNotFoundError when found but not owned by userId', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )

    await expect(
      DeleteTransactionUseCase.deleteTransaction({
        id: 'txn-1',
        userId: 'someone-else',
      }),
    ).rejects.toThrow(TransactionNotFoundError)

    expect(TransactionRepository.remove).not.toHaveBeenCalled()
  })

  it('T-017: when found and owned, calls TransactionRepository.remove(id)', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )
    ;(TransactionRepository.remove as jest.Mock).mockResolvedValue(undefined)

    await DeleteTransactionUseCase.deleteTransaction({
      id: 'txn-1',
      userId: 'user-1',
    })

    expect(TransactionRepository.remove).toHaveBeenCalledWith('txn-1')
  })
})
