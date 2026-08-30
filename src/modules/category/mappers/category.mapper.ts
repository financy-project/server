import type { Category, UpdateCategoryPatch } from '../entity/category.entity'
import { CategoryType } from '../graphql/object-types/category.object-type'
import type { UpdateCategoryInput } from '../graphql/input-types/update-category.input'

export const toCategoryType = (category: Category): CategoryType => {
  const type = new CategoryType()
  type.id = category.id
  type.title = category.title
  type.description = category.description
  type.icon = category.icon
  type.color = category.color
  return type
}

export const toUpdateCategoryPatch = (
  input: UpdateCategoryInput,
): UpdateCategoryPatch => {
  const patch: UpdateCategoryPatch = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.color !== undefined) patch.color = input.color
  return patch
}
