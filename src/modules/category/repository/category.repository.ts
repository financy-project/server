import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { Category, type UpdateCategoryPatch } from '../entity/category.entity'
import {
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
} from '../errors/category-errors'

const create = async (category: Category): Promise<Category> => {
  try {
    const row = await prisma.category.create({
      data: {
        id: category.id,
        userId: category.userId,
        title: category.title,
        description: category.description,
        icon: category.icon,
        color: category.color,
      },
    })

    return Category.fromRepository(row)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new CategoryAlreadyExistsError()
    }
    throw error
  }
}

const findById = async (id: string): Promise<Category> => {
  const row = await prisma.category.findUnique({ where: { id } })

  if (!row) {
    throw new CategoryNotFoundError()
  }

  return Category.fromRepository(row)
}

const findAllByUserId = async (userId: string): Promise<Category[]> => {
  const rows = await prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((row) => Category.fromRepository(row))
}

const update = async (
  id: string,
  patch: UpdateCategoryPatch,
): Promise<Category> => {
  try {
    const row = await prisma.category.update({ where: { id }, data: patch })

    return Category.fromRepository(row)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new CategoryNotFoundError()
      }
      if (error.code === 'P2002') {
        throw new CategoryAlreadyExistsError()
      }
    }
    throw error
  }
}

const remove = async (id: string): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id } })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new CategoryNotFoundError()
    }
    throw error
  }
}

export const CategoryRepository = {
  create,
  findById,
  findAllByUserId,
  update,
  remove,
}
