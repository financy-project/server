import 'reflect-metadata'
import { Transaction } from '../../../entity/transaction.entity'
import { TransactionKind } from '../../../enums/transaction-kind.enum'
import type { CategoryDTO } from '../../../ports'
import type { UpdateTransactionInput } from '../../../graphql/input-types/update-transaction.input'
import {
  toTransactionCategoryType,
  toTransactionType,
  toUpdateTransactionPatch,
} from '../../../mappers/transaction.mapper'

describe('transaction mappers', () => {
  describe('toTransactionType', () => {
    it('T-018: maps all five exposed fields plus the internal categoryId', () => {
      const date = new Date('2026-09-01T00:00:00.000Z')
      const transaction = Transaction.fromRepository({
        id: 'txn-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date,
        value: 5000,
      })

      const result = toTransactionType(transaction)

      expect(result.id).toBe('txn-1')
      expect(result.type).toBe(TransactionKind.EXPENSE)
      expect(result.description).toBe('Groceries')
      expect(result.date).toBe(date)
      expect(result.value).toBe(5000)
      expect(result.categoryId).toBe('cat-1')
    })

    it('T-018: maps a null categoryId through to the internal field', () => {
      const transaction = Transaction.fromRepository({
        id: 'txn-2',
        userId: 'user-1',
        categoryId: null,
        type: TransactionKind.INCOME,
        description: 'Salary',
        date: new Date(),
        value: 100000,
      })

      const result = toTransactionType(transaction)

      expect(result.categoryId).toBeNull()
    })
  })

  describe('toTransactionCategoryType', () => {
    it('T-018: maps id, title and color', () => {
      const category: CategoryDTO = {
        id: 'cat-1',
        userId: 'user-1',
        title: 'Groceries',
        color: '#FF00AA',
      }

      const result = toTransactionCategoryType(category)

      expect(result.id).toBe('cat-1')
      expect(result.title).toBe('Groceries')
      expect(result.color).toBe('#FF00AA')
    })
  })

  describe('toUpdateTransactionPatch', () => {
    it('T-018: only includes explicitly-provided fields', () => {
      const input = { description: 'New description' } as UpdateTransactionInput

      const result = toUpdateTransactionPatch(input)

      expect(result).toEqual({ description: 'New description' })
    })

    it('T-018: maps every provided field', () => {
      const date = new Date('2026-09-01T00:00:00.000Z')
      const input: UpdateTransactionInput = {
        type: TransactionKind.INCOME,
        description: 'New description',
        date,
        value: 100,
        categoryId: 'cat-2',
      }

      const result = toUpdateTransactionPatch(input)

      expect(result).toEqual({
        type: TransactionKind.INCOME,
        description: 'New description',
        date,
        value: 100,
        categoryId: 'cat-2',
      })
    })
  })
})
