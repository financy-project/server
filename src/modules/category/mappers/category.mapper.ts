import type { Category } from '../entity/category.entity'
import { CategoryType } from '../graphql/object-types/category.object-type'

export const toCategoryType = (category: Category): CategoryType => {
  const type = new CategoryType()
  type.id = category.id
  type.title = category.title
  type.description = category.description
  type.icon = category.icon
  type.color = category.color
  return type
}
