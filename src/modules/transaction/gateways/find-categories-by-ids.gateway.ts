import { findCategoriesByIdsAdapter } from '@/modules/category/adapters'
import type { CategoryDTO } from '../ports'

// Gateway consumed by this module's use-cases (never the adapter directly).
// Cross-cutting logic (dedup, empty-array short-circuit) lives here so
// use-cases stay focused on business rules.
export const findCategoriesByIds = async (
  ids: string[],
): Promise<CategoryDTO[]> => {
  const uniqueIds = Array.from(new Set(ids))

  if (uniqueIds.length === 0) {
    return []
  }

  return findCategoriesByIdsAdapter(uniqueIds)
}
