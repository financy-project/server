import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { generateUUID } from '@/shared/utils/uuid'
import { Transaction } from '../../../entity/transaction.entity'
import { TransactionRepository } from '../../../repository/transaction.repository'
import { TransactionNotFoundError } from '../../../errors/transaction-errors'
import { TransactionKind } from '../../../enums/transaction-kind.enum'

describe('TransactionRepository (integration)', () => {
  useDatabase()

  const createUser = async () => {
    const id = generateUUID()
    return prisma.user.create({
      data: {
        id,
        email: `${id}@example.com`,
        name: 'Test User',
      },
    })
  }

  const createCategory = async (userId: string) => {
    const id = generateUUID()
    return prisma.category.create({
      data: {
        id,
        userId,
        title: `Category ${id}`,
        icon: 'icon',
        color: '#111111',
      },
    })
  }

  describe('create', () => {
    it('persists a transaction and returns it', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)
      const transaction = Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.EXPENSE,
        description: 'Groceries',
        date: new Date('2026-01-15'),
        value: 1000,
      })

      const result = await TransactionRepository.create(transaction)

      expect(result.id).toBe(transaction.id)
      expect(result.userId).toBe(user.id)
      expect(result.categoryId).toBe(category.id)
      expect(result.type).toBe(TransactionKind.EXPENSE)
      expect(result.description).toBe('Groceries')
      expect(result.value).toBe(1000)
    })
  })

  describe('findById', () => {
    it('returns the transaction when found', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)
      const transaction = Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.INCOME,
        description: 'Salary',
        date: new Date('2026-01-01'),
        value: 500000,
      })
      await TransactionRepository.create(transaction)

      const result = await TransactionRepository.findById(transaction.id)

      expect(result.id).toBe(transaction.id)
      expect(result.description).toBe('Salary')
    })

    it('throws TransactionNotFoundError when the transaction does not exist', async () => {
      await expect(
        TransactionRepository.findById(generateUUID()),
      ).rejects.toThrow(TransactionNotFoundError)
    })
  })

  describe('findAllByUserId', () => {
    it('returns only the given user transactions within the date range', async () => {
      const userA = await createUser()
      const userB = await createUser()
      const categoryA = await createCategory(userA.id)
      const categoryB = await createCategory(userB.id)

      const inRange = Transaction.create({
        userId: userA.id,
        categoryId: categoryA.id,
        type: TransactionKind.EXPENSE,
        description: 'In range',
        date: new Date('2026-01-15'),
        value: 100,
      })
      const outOfRange = Transaction.create({
        userId: userA.id,
        categoryId: categoryA.id,
        type: TransactionKind.EXPENSE,
        description: 'Out of range',
        date: new Date('2026-02-15'),
        value: 100,
      })
      const otherUser = Transaction.create({
        userId: userB.id,
        categoryId: categoryB.id,
        type: TransactionKind.EXPENSE,
        description: "Other user's",
        date: new Date('2026-01-15'),
        value: 100,
      })

      await TransactionRepository.create(inRange)
      await TransactionRepository.create(outOfRange)
      await TransactionRepository.create(otherUser)

      const result = await TransactionRepository.findAllByUserId(
        userA.id,
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
        { first: 20, after: null },
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.id).toBe(inRange.id)
      expect(result.hasNextPage).toBe(false)
    })

    it('paginates ordered by date DESC, id DESC with correct hasNextPage/endCursor', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)

      const transactions = await Promise.all(
        [1, 2, 3, 4, 5].map((day) =>
          TransactionRepository.create(
            Transaction.create({
              userId: user.id,
              categoryId: category.id,
              type: TransactionKind.EXPENSE,
              description: `Day ${day}`,
              date: new Date(`2026-01-0${day}`),
              value: 100,
            }),
          ),
        ),
      )
      const expectedOrder = [...transactions].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      )

      const firstPage = await TransactionRepository.findAllByUserId(
        user.id,
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
        { first: 2, after: null },
      )

      expect(firstPage.items.map((item) => item.id)).toEqual(
        expectedOrder.slice(0, 2).map((item) => item.id),
      )
      expect(firstPage.hasNextPage).toBe(true)
      expect(firstPage.endCursor).not.toBeNull()

      const secondPage = await TransactionRepository.findAllByUserId(
        user.id,
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
        { first: 2, after: firstPage.endCursor },
      )

      expect(secondPage.items.map((item) => item.id)).toEqual(
        expectedOrder.slice(2, 4).map((item) => item.id),
      )
      expect(secondPage.hasNextPage).toBe(true)

      const thirdPage = await TransactionRepository.findAllByUserId(
        user.id,
        { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
        { first: 2, after: secondPage.endCursor },
      )

      expect(thirdPage.items.map((item) => item.id)).toEqual(
        expectedOrder.slice(4, 5).map((item) => item.id),
      )
      expect(thirdPage.hasNextPage).toBe(false)
      expect(thirdPage.endCursor).not.toBeNull()
    })
  })

  describe('update', () => {
    it('persists the patched fields', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)
      const transaction = Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.EXPENSE,
        description: 'Original',
        date: new Date('2026-01-15'),
        value: 100,
      })
      await TransactionRepository.create(transaction)

      const result = await TransactionRepository.update(transaction.id, {
        description: 'Updated',
        value: 200,
      })

      expect(result.description).toBe('Updated')
      expect(result.value).toBe(200)
    })

    it('throws TransactionNotFoundError for a missing id', async () => {
      await expect(
        TransactionRepository.update(generateUUID(), { description: 'New' }),
      ).rejects.toThrow(TransactionNotFoundError)
    })
  })

  describe('countByCategoryIds', () => {
    it('returns the correct count per categoryId across multiple categories', async () => {
      const user = await createUser()
      const categoryA = await createCategory(user.id)
      const categoryB = await createCategory(user.id)

      await TransactionRepository.create(
        Transaction.create({
          userId: user.id,
          categoryId: categoryA.id,
          type: TransactionKind.EXPENSE,
          description: 'A1',
          date: new Date('2026-01-01'),
          value: 100,
        }),
      )
      await TransactionRepository.create(
        Transaction.create({
          userId: user.id,
          categoryId: categoryA.id,
          type: TransactionKind.EXPENSE,
          description: 'A2',
          date: new Date('2026-01-02'),
          value: 100,
        }),
      )
      await TransactionRepository.create(
        Transaction.create({
          userId: user.id,
          categoryId: categoryB.id,
          type: TransactionKind.EXPENSE,
          description: 'B1',
          date: new Date('2026-01-03'),
          value: 100,
        }),
      )

      const result = await TransactionRepository.countByCategoryIds([
        categoryA.id,
        categoryB.id,
      ])

      expect(result).toEqual({ [categoryA.id]: 2, [categoryB.id]: 1 })
    })

    it('omits a categoryId with zero transactions from the returned map', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)

      const result = await TransactionRepository.countByCategoryIds([
        category.id,
      ])

      expect(result).toEqual({})
    })

    it('returns {} for an empty categoryIds input', async () => {
      const result = await TransactionRepository.countByCategoryIds([])

      expect(result).toEqual({})
    })
  })

  describe('remove', () => {
    it('deletes the row', async () => {
      const user = await createUser()
      const category = await createCategory(user.id)
      const transaction = Transaction.create({
        userId: user.id,
        categoryId: category.id,
        type: TransactionKind.EXPENSE,
        description: 'ToDelete',
        date: new Date('2026-01-15'),
        value: 100,
      })
      await TransactionRepository.create(transaction)

      await TransactionRepository.remove(transaction.id)

      await expect(
        TransactionRepository.findById(transaction.id),
      ).rejects.toThrow(TransactionNotFoundError)
    })

    it('throws TransactionNotFoundError for a missing id', async () => {
      await expect(
        TransactionRepository.remove(generateUUID()),
      ).rejects.toThrow(TransactionNotFoundError)
    })
  })
})
