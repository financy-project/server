import { countTransactionsByCategoryIdsAdapter } from '@/modules/transaction/adapters'
import type { CountTransactionsByCategoryIdsPort } from '../ports'

// Gateway consumed by this module's resolvers (never the adapter directly).
// Cross-cutting logic (dedup, empty-array short-circuit) lives here so the
// FieldResolver stays focused on translating the loader's result to GraphQL.
export const countTransactionsByCategoryIds: CountTransactionsByCategoryIdsPort =
  async (categoryIds) => {
    const uniqueIds = Array.from(new Set(categoryIds))

    if (uniqueIds.length === 0) {
      return {}
    }

    return countTransactionsByCategoryIdsAdapter(uniqueIds)
  }
