import { reassignTransactionsCategoryAdapter } from '@/modules/transaction/adapters'
import type { ReassignTransactionsCategoryPort } from '../ports'

// Gateway consumed by this module's use-cases (never the adapter directly).
export const reassignTransactionsCategory: ReassignTransactionsCategoryPort = (
  params,
) => reassignTransactionsCategoryAdapter(params)
