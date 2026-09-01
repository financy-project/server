import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'
import { TransactionCategoryNotFoundError } from '../../../errors/transaction-errors'

jest.mock('../../../repository/transaction.repository', () => ({
  TransactionRepository: {
    create: jest.fn(),
  },
}))
jest.mock('../../../gateways/find-categories-by-ids.gateway', () => ({
  findCategoriesByIds: jest.fn(),
}))

import { TransactionRepository } from '../../../repository/transaction.repository'
import { findCategoriesByIds } from '../../../gateways/find-categories-by-ids.gateway'
import { CreateTransactionUseCase } from '../../../use-cases/create-transaction.use-case'

const baseInput = {
  userId: 'user-1',
  categoryId: 'cat-1',
  type: TransactionKind.EXPENSE,
  description: 'Groceries',
  date: new Date('2026-09-01T00:00:00.000Z'),
  value: 5000,
}

describe('CreateTransactionUseCase.createTransaction()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-015: happy path — categoryId belongs to userId, creates and returns the Transaction', async () => {
    ;(findCategoriesByIds as jest.Mock).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', title: 'Groceries', color: '#FFF' },
    ])
    const created = Transaction.fromRepository({
      id: 'txn-1',
      ...baseInput,
    })
    ;(TransactionRepository.create as jest.Mock).mockResolvedValue(created)

    const result = await CreateTransactionUseCase.createTransaction(baseInput)

    expect(findCategoriesByIds).toHaveBeenCalledWith(['cat-1'])
    expect(TransactionRepository.create).toHaveBeenCalled()
    expect(result).toBe(created)
  })

  it('T-015: categoryId does not exist (gateway returns []) → TransactionCategoryNotFoundError', async () => {
    ;(findCategoriesByIds as jest.Mock).mockResolvedValue([])

    await expect(
      CreateTransactionUseCase.createTransaction(baseInput),
    ).rejects.toThrow(TransactionCategoryNotFoundError)

    expect(TransactionRepository.create).not.toHaveBeenCalled()
  })

  it('T-015: categoryId belongs to another user → TransactionCategoryNotFoundError', async () => {
    ;(findCategoriesByIds as jest.Mock).mockResolvedValue([
      { id: 'cat-1', userId: 'someone-else', title: 'Rent', color: '#000' },
    ])

    await expect(
      CreateTransactionUseCase.createTransaction(baseInput),
    ).rejects.toThrow(TransactionCategoryNotFoundError)

    expect(TransactionRepository.create).not.toHaveBeenCalled()
  })
})
