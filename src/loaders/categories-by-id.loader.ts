import DataLoader from 'dataloader'
import { CategoryRepository } from '@/repositories/category.repository'
import type { Category } from '@/entities/category.entity'

export const buildCategoriesByIdLoader = (): DataLoader<
  string,
  Category | null
> =>
  new DataLoader<string, Category | null>(async (ids) => {
    const uniqueIds = Array.from(new Set(ids))
    const categories =
      uniqueIds.length > 0
        ? await CategoryRepository.findManyByIds(uniqueIds)
        : []
    const byId = new Map(categories.map((category) => [category.id, category]))

    // DataLoader requires the output array to match the input keys 1:1, in order
    return ids.map((id) => byId.get(id) ?? null)
  })
