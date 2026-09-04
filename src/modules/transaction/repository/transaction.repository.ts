import { Prisma, type Transaction as TransactionRow } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decodeCursor, encodeCursor } from '@/shared/utils/cursor'
import {
  Transaction,
  type UpdateTransactionPatch,
} from '../entity/transaction.entity'
import { TransactionNotFoundError } from '../errors/transaction-errors'
import { TransactionKind } from '../enums/transaction-kind.enum'

// Prisma generates its TransactionKind as a plain string-literal union, not
// the nominal enum this module's own TransactionKind is — same values, so a
// cast (not a mapping) is all that's needed to bridge the two.
const fromRow = (row: TransactionRow): Transaction =>
  Transaction.fromRepository({ ...row, type: row.type as TransactionKind })

const create = async (transaction: Transaction): Promise<Transaction> => {
  const row = await prisma.transaction.create({
    data: {
      id: transaction.id,
      userId: transaction.userId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      value: transaction.value,
    },
  })

  return fromRow(row)
}

const findById = async (id: string): Promise<Transaction> => {
  const row = await prisma.transaction.findUnique({ where: { id } })

  if (!row) {
    throw new TransactionNotFoundError()
  }

  return fromRow(row)
}

const findAllByUserId = async (
  userId: string,
  filter: {
    startDate: Date | null
    endDate: Date | null
    description: string | null
    type: TransactionKind | null
    categoryIds: string[] | null
  },
  pagination: { first: number; after: string | null },
): Promise<{
  items: Transaction[]
  hasNextPage: boolean
  endCursor: string | null
}> => {
  const cursor = pagination.after ? decodeCursor(pagination.after) : null

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      ...(filter.startDate && filter.endDate
        ? { date: { gte: filter.startDate, lte: filter.endDate } }
        : {}),
      ...(filter.description
        ? {
            description: {
              contains: filter.description,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.categoryIds && filter.categoryIds.length > 0
        ? { categoryId: { in: filter.categoryIds } }
        : {}),
      ...(cursor
        ? {
            OR: [
              { date: { lt: cursor.date } },
              { date: cursor.date, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: pagination.first + 1,
  })

  const hasNextPage = rows.length > pagination.first
  const items = (hasNextPage ? rows.slice(0, pagination.first) : rows).map(
    fromRow,
  )
  const lastItem = items[items.length - 1]
  const endCursor = lastItem
    ? encodeCursor({ date: lastItem.date, id: lastItem.id })
    : null

  return { items, hasNextPage, endCursor }
}

const update = async (
  id: string,
  patch: UpdateTransactionPatch,
): Promise<Transaction> => {
  try {
    const row = await prisma.transaction.update({ where: { id }, data: patch })

    return fromRow(row)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new TransactionNotFoundError()
    }
    throw error
  }
}

const remove = async (id: string): Promise<void> => {
  try {
    await prisma.transaction.delete({ where: { id } })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new TransactionNotFoundError()
    }
    throw error
  }
}

const countByCategoryIds = async (
  categoryIds: string[],
): Promise<Record<string, number>> => {
  if (categoryIds.length === 0) return {}

  const groups = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { categoryId: { in: categoryIds } },
    _count: { _all: true },
  })

  return groups.reduce<Record<string, number>>((counts, group) => {
    if (group.categoryId) {
      counts[group.categoryId] = group._count._all
    }
    return counts
  }, {})
}

export const TransactionRepository = {
  create,
  findById,
  findAllByUserId,
  update,
  remove,
  countByCategoryIds,
}
