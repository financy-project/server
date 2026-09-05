import type { ReassignTransactionsCategoryPort } from '@/modules/category/ports'
import { TransactionRepository } from '../repository/transaction.repository'

// Adapter implementing the category module's ReassignTransactionsCategoryPort.
// Lives here (the data-owning module) per "adapter lives where the data is";
// the category module's gateway imports this directly — the one sanctioned
// cross-module import point for this port/adapter/gateway pattern.
export const reassignTransactionsCategoryAdapter: ReassignTransactionsCategoryPort =
  (params) =>
    TransactionRepository.reassignCategory(
      params.fromCategoryId,
      params.toCategoryId,
    )
