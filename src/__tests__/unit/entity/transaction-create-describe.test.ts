import { Transaction, TransactionKind } from '@/entities/transaction.entity'

describe('Transaction entity', () => {
  describe('create', () => {
    it('generates an id and copies all fields', () => {
      const date = new Date('2026-09-01T00:00:00.000Z')

      const transaction = Transaction.create({
        userId: 'user-1',
        categoryId: 'category-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date,
        value: 5000,
      })

      expect(transaction.id).toEqual(expect.any(String))
      expect(transaction.id.length).toBeGreaterThan(0)
      expect(transaction.userId).toBe('user-1')
      expect(transaction.categoryId).toBe('category-1')
      expect(transaction.type).toBe(TransactionKind.EXPENSE)
      expect(transaction.description).toBe('Groceries')
      expect(transaction.date).toBe(date)
      expect(transaction.value).toBe(5000)
    })
  })

  describe('fromRepository', () => {
    it('rehydrates a transaction from persisted props', () => {
      const date = new Date('2026-09-01T00:00:00.000Z')

      const transaction = Transaction.fromRepository({
        id: 'transaction-1',
        userId: 'user-1',
        categoryId: null,
        type: TransactionKind.INCOME,
        description: 'Salary',
        date,
        value: 100000,
      })

      expect(transaction.id).toBe('transaction-1')
      expect(transaction.categoryId).toBeNull()
      expect(transaction.type).toBe(TransactionKind.INCOME)
    })
  })

  describe('belongsTo', () => {
    it('returns true when the userId matches the owner', () => {
      const transaction = Transaction.create({
        userId: 'user-1',
        categoryId: 'category-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date(),
        value: 100,
      })

      expect(transaction.belongsTo('user-1')).toBe(true)
    })

    it('returns false when the userId does not match the owner', () => {
      const transaction = Transaction.create({
        userId: 'user-1',
        categoryId: 'category-1',
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date(),
        value: 100,
      })

      expect(transaction.belongsTo('user-2')).toBe(false)
    })
  })
})
