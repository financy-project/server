import { encodeCursor } from '@/shared/utils/cursor'
import type { Transaction } from '../entity/transaction.entity'
import {
  TransactionConnection,
  TransactionEdge,
} from '../graphql/object-types/transaction-connection.object-type'
import { toTransactionType } from './transaction.mapper'

type PaginatedTransactions = {
  items: Transaction[]
  hasNextPage: boolean
  endCursor: string | null
}

export const toTransactionConnection = (
  result: PaginatedTransactions,
): TransactionConnection => {
  const connection = new TransactionConnection()
  connection.edges = result.items.map((transaction) => {
    const edge = new TransactionEdge()
    edge.node = toTransactionType(transaction)
    edge.cursor = encodeCursor({ date: transaction.date, id: transaction.id })
    return edge
  })
  connection.pageInfo = {
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor,
  }
  return connection
}
