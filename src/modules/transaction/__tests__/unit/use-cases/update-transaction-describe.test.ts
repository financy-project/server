import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'
import {
  TransactionCategoryNotFoundError,
  TransactionNotFoundError,
} from '../../../errors/transaction-errors'

jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    findById: jest.fn(),
    update: jest.fn(),
  },
}))
jest.mock('../../../gateways/find-categories-by-ids.gateway', () => ({
  findCategoriesByIds: jest.fn(),
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { findCategoriesByIds } from '../../../gateways/find-categories-by-ids.gateway'
import { UpdateTransactionUseCase } from '../../../use-cases/update-transaction.use-case'

const ownedTransaction = Transaction.fromRepository({
  id: 'txn-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  type: TransactionKind.EXPENSE,
  description: 'Groceries',
  date: new Date('2026-09-01T00:00:00.000Z'),
  value: 5000,
})

describe('UpdateTransactionUseCase.updateTransaction()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-017: propagates TransactionNotFoundError when findById throws (not found)', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockRejectedValue(
      new TransactionNotFoundError(),
    )

    await expect(
      UpdateTransactionUseCase.updateTransaction({
        id: 'txn-1',
        userId: 'user-1',
        patch: { description: 'New' },
      }),
    ).rejects.toThrow(TransactionNotFoundError)

    expect(TransactionRepository.update).not.toHaveBeenCalled()
  })

  it('T-017: throws TransactionNotFoundError when found but not owned by userId', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )

    await expect(
      UpdateTransactionUseCase.updateTransaction({
        id: 'txn-1',
        userId: 'someone-else',
        patch: { description: 'New' },
      }),
    ).rejects.toThrow(TransactionNotFoundError)

    expect(TransactionRepository.update).not.toHaveBeenCalled()
  })

  it('T-017: foreign/nonexistent categoryId → TransactionCategoryNotFoundError, no write', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )
    ;(findCategoriesByIds as jest.Mock).mockResolvedValue([])

    await expect(
      UpdateTransactionUseCase.updateTransaction({
        id: 'txn-1',
        userId: 'user-1',
        patch: { categoryId: 'foreign-cat' },
      }),
    ).rejects.toThrow(TransactionCategoryNotFoundError)

    expect(TransactionRepository.update).not.toHaveBeenCalled()
  })

  it('T-017: owned, patch.categoryId omitted → delegates to TransactionRepository.update', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )
    const updated = Transaction.fromRepository({
      ...ownedTransaction,
      description: 'New',
    })
    ;(TransactionRepository.update as jest.Mock).mockResolvedValue(updated)

    const patch = { description: 'New' }
    const result = await UpdateTransactionUseCase.updateTransaction({
      id: 'txn-1',
      userId: 'user-1',
      patch,
    })

    expect(findCategoriesByIds).not.toHaveBeenCalled()
    expect(TransactionRepository.update).toHaveBeenCalledWith('txn-1', patch)
    expect(result).toBe(updated)
  })

  it('T-017: owned, patch.categoryId valid and owned → delegates to TransactionRepository.update', async () => {
    ;(TransactionRepository.findById as jest.Mock).mockResolvedValue(
      ownedTransaction,
    )
    ;(findCategoriesByIds as jest.Mock).mockResolvedValue([
      { id: 'cat-2', userId: 'user-1', title: 'Rent', color: '#000' },
    ])
    const updated = Transaction.fromRepository({
      ...ownedTransaction,
      categoryId: 'cat-2',
    })
    ;(TransactionRepository.update as jest.Mock).mockResolvedValue(updated)

    const patch = { categoryId: 'cat-2' }
    const result = await UpdateTransactionUseCase.updateTransaction({
      id: 'txn-1',
      userId: 'user-1',
      patch,
    })

    expect(TransactionRepository.update).toHaveBeenCalledWith('txn-1', patch)
    expect(result).toBe(updated)
  })
})
