// Port owned by the 'category' module: describes the shape of the
// transaction reassignment this module needs from the 'transaction' module,
// without importing it directly. The 'transaction' module provides an
// adapter implementing this port (see
// src/modules/transaction/adapters/reassign-transactions-category.adapter.ts).
export type ReassignTransactionsCategoryPort = (params: {
  fromCategoryId: string
  toCategoryId: string
}) => Promise<void>
