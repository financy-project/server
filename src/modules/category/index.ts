// Public API for the 'category' module.
// Only export: entity, types, enums, errors, repository, resolver.
// NEVER export: use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders.

export { Category } from './entity'
export type {
  CategoryProps,
  CreateCategoryProps,
  UpdateCategoryPatch,
} from './entity'
export { CategoryRepository } from './repository'
export { CategoryNotFoundError, CategoryAlreadyExistsError } from './errors'
export { CategoryResolver } from './resolvers'
