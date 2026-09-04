import type { CountTransactionsByCategoryIdsPort } from '@/modules/category/ports'
import { TransactionRepository } from '../repository/transaction.repository'

// Adapter implementing the category module's CountTransactionsByCategoryIdsPort.
// Lives here (the data-owning module) per "adapter lives where the data is";
// the category module's gateway imports this directly — the one sanctioned
// cross-module import point for this port/adapter/gateway pattern.
export const countTransactionsByCategoryIdsAdapter: CountTransactionsByCategoryIdsPort =
  (categoryIds) => TransactionRepository.countByCategoryIds(categoryIds)
