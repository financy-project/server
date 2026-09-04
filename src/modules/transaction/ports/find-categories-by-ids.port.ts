// Port owned by the 'transaction' module: describes the shape of category
// lookups this module needs from the 'category' module, without importing
// it directly. The 'category' module provides an adapter implementing this
// port (see src/modules/category/adapters/find-categories-by-ids.adapter.ts).
export type CategoryDTO = {
  id: string
  userId: string
  title: string
  description: string | null
  icon: string
  color: string
}

export type FindCategoriesByIdsPort = (ids: string[]) => Promise<CategoryDTO[]>
