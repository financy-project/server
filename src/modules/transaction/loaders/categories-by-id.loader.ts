import DataLoader from 'dataloader'
import type { CategoryDTO } from '../ports'
import { findCategoriesByIds } from '../gateways/find-categories-by-ids.gateway'

export const buildCategoriesByIdLoader = (): DataLoader<
  string,
  CategoryDTO | null
> =>
  new DataLoader<string, CategoryDTO | null>(async (ids) => {
    const categories = await findCategoriesByIds([...ids])
    const byId = new Map(categories.map((category) => [category.id, category]))

    // DataLoader requires the output array to match the input keys 1:1, in order
    return ids.map((id) => byId.get(id) ?? null)
  })
