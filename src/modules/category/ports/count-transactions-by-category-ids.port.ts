// Port owned by the 'category' module: describes the shape of transaction
// counts this module needs from the 'transaction' module, without importing
// it directly. The 'transaction' module provides an adapter implementing
// this port (see
// src/modules/transaction/adapters/count-transactions-by-category-ids.adapter.ts).
export type CountTransactionsByCategoryIdsPort = (
  categoryIds: string[],
) => Promise<Record<string, number>>
