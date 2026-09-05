import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { generateUUID } from '@/shared/utils/uuid'
import { Category } from '../../../entity/category.entity'
import { CategoryRepository } from '../../../repository/category.repository'
import {
  CategoryNotFoundError,
  CategoryAlreadyExistsError,
} from '../../../errors/category-errors'

describe('CategoryRepository (integration)', () => {
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

  describe('create', () => {
    it('persists a category and returns it', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'Groceries',
        description: 'Weekly food shopping',
        icon: 'cart',
        color: '#FF00AA',
      })

      const result = await CategoryRepository.create(category)

      expect(result.id).toBe(category.id)
      expect(result.userId).toBe(user.id)
      expect(result.title).toBe('Groceries')
      expect(result.description).toBe('Weekly food shopping')
      expect(result.icon).toBe('cart')
      expect(result.color).toBe('#FF00AA')
    })

    it('throws CategoryAlreadyExistsError on a duplicate (userId, title)', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'Groceries',
        description: null,
        icon: 'cart',
        color: '#FF00AA',
      })
      await CategoryRepository.create(category)

      const duplicate = Category.create({
        userId: user.id,
        title: 'Groceries',
        description: null,
        icon: 'cart',
        color: '#00FF00',
      })

      await expect(CategoryRepository.create(duplicate)).rejects.toThrow(
        CategoryAlreadyExistsError,
      )
    })
  })

  describe('upsertByUserIdAndTitle', () => {
    it('creates the category when no row matches (userId, title)', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'Outros',
        description: null,
        icon: 'tag',
        color: '#2563EB',
      })

      const result = await CategoryRepository.upsertByUserIdAndTitle(category)

      expect(result.id).toBe(category.id)
      expect(result.title).toBe('Outros')
      expect(result.icon).toBe('tag')
      expect(result.color).toBe('#2563EB')
    })

    it('returns the existing row unchanged when (userId, title) already exists', async () => {
      const user = await createUser()
      const existing = Category.create({
        userId: user.id,
        title: 'Outros',
        description: null,
        icon: 'tag',
        color: '#2563EB',
      })
      await CategoryRepository.create(existing)

      const attempt = Category.create({
        userId: user.id,
        title: 'Outros',
        description: null,
        icon: 'different-icon',
        color: '#000000',
      })

      const result = await CategoryRepository.upsertByUserIdAndTitle(attempt)

      expect(result.id).toBe(existing.id)
      expect(result.icon).toBe('tag')
      expect(result.color).toBe('#2563EB')
    })
  })

  describe('findById', () => {
    it('returns the category when found', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'Transport',
        description: null,
        icon: 'car',
        color: '#123456',
      })
      await CategoryRepository.create(category)

      const result = await CategoryRepository.findById(category.id)

      expect(result.id).toBe(category.id)
      expect(result.title).toBe('Transport')
    })

    it('throws CategoryNotFoundError when the category does not exist', async () => {
      await expect(CategoryRepository.findById(generateUUID())).rejects.toThrow(
        CategoryNotFoundError,
      )
    })
  })

  describe('findManyByIds', () => {
    it('returns only the matching categories', async () => {
      const user = await createUser()
      const categoryA = Category.create({
        userId: user.id,
        title: 'A',
        description: null,
        icon: 'icon',
        color: '#111111',
      })
      const categoryB = Category.create({
        userId: user.id,
        title: 'B',
        description: null,
        icon: 'icon',
        color: '#222222',
      })
      const categoryC = Category.create({
        userId: user.id,
        title: 'C',
        description: null,
        icon: 'icon',
        color: '#333333',
      })
      await CategoryRepository.create(categoryA)
      await CategoryRepository.create(categoryB)
      await CategoryRepository.create(categoryC)

      const result = await CategoryRepository.findManyByIds([
        categoryA.id,
        categoryC.id,
      ])

      expect(result.map((category) => category.id).sort()).toEqual(
        [categoryA.id, categoryC.id].sort(),
      )
    })

    it('returns an empty array for an empty input', async () => {
      const result = await CategoryRepository.findManyByIds([])

      expect(result).toEqual([])
    })

    it('returns an empty array when no ids match', async () => {
      const result = await CategoryRepository.findManyByIds([generateUUID()])

      expect(result).toEqual([])
    })
  })

  describe('findAllByUserId', () => {
    it('returns only the given user categories, ordered by createdAt', async () => {
      const userA = await createUser()
      const userB = await createUser()

      const categoryA1 = Category.create({
        userId: userA.id,
        title: 'A1',
        description: null,
        icon: 'icon',
        color: '#111111',
      })
      const categoryA2 = Category.create({
        userId: userA.id,
        title: 'A2',
        description: null,
        icon: 'icon',
        color: '#222222',
      })
      const categoryB = Category.create({
        userId: userB.id,
        title: 'B1',
        description: null,
        icon: 'icon',
        color: '#333333',
      })

      await CategoryRepository.create(categoryA1)
      await CategoryRepository.create(categoryA2)
      await CategoryRepository.create(categoryB)

      const result = await CategoryRepository.findAllByUserId(userA.id)

      expect(result).toHaveLength(2)
      expect(result.map((category) => category.title)).toEqual(['A1', 'A2'])
      expect(result.every((category) => category.userId === userA.id)).toBe(
        true,
      )
    })
  })

  describe('update', () => {
    it('persists the patched fields', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'Original',
        description: null,
        icon: 'icon',
        color: '#111111',
      })
      await CategoryRepository.create(category)

      const result = await CategoryRepository.update(category.id, {
        title: 'Updated',
        color: '#999999',
      })

      expect(result.title).toBe('Updated')
      expect(result.color).toBe('#999999')
    })

    it('throws CategoryNotFoundError for a missing id', async () => {
      await expect(
        CategoryRepository.update(generateUUID(), { title: 'New Title' }),
      ).rejects.toThrow(CategoryNotFoundError)
    })

    it('throws CategoryAlreadyExistsError on a title collision', async () => {
      const user = await createUser()
      const categoryOne = Category.create({
        userId: user.id,
        title: 'One',
        description: null,
        icon: 'icon',
        color: '#111111',
      })
      const categoryTwo = Category.create({
        userId: user.id,
        title: 'Two',
        description: null,
        icon: 'icon',
        color: '#222222',
      })
      await CategoryRepository.create(categoryOne)
      await CategoryRepository.create(categoryTwo)

      await expect(
        CategoryRepository.update(categoryTwo.id, { title: 'One' }),
      ).rejects.toThrow(CategoryAlreadyExistsError)
    })
  })

  describe('remove', () => {
    it('deletes the row', async () => {
      const user = await createUser()
      const category = Category.create({
        userId: user.id,
        title: 'ToDelete',
        description: null,
        icon: 'icon',
        color: '#111111',
      })
      await CategoryRepository.create(category)

      await CategoryRepository.remove(category.id)

      await expect(CategoryRepository.findById(category.id)).rejects.toThrow(
        CategoryNotFoundError,
      )
    })

    it('throws CategoryNotFoundError for a missing id', async () => {
      await expect(CategoryRepository.remove(generateUUID())).rejects.toThrow(
        CategoryNotFoundError,
      )
    })
  })
})
