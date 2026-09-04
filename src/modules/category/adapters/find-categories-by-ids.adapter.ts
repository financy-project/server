import type {
  CategoryDTO,
  FindCategoriesByIdsPort,
} from '@/modules/transaction/ports'
import { CategoryRepository } from '../repository/category.repository'

// Adapter implementing the transaction module's FindCategoriesByIdsPort.
// Lives here (the producing module) per "adapter lives where the data is";
// the transaction module's gateway imports this directly — the one
// sanctioned cross-module import point for this port/adapter/gateway
// pattern.
export const findCategoriesByIdsAdapter: FindCategoriesByIdsPort = async (
  ids: string[],
): Promise<CategoryDTO[]> => {
  const categories = await CategoryRepository.findManyByIds(ids)

  return categories.map((category) => ({
    id: category.id,
    userId: category.userId,
    title: category.title,
    description: category.description,
    icon: category.icon,
    color: category.color,
  }))
}
