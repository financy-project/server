// Public API for the 'transaction' module.
// Only export: entity, types, enums, errors, repository, resolver.
// NEVER export: use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders.

export { Transaction } from './entity'
export type {
  TransactionProps,
  CreateTransactionProps,
  UpdateTransactionPatch,
} from './entity'
export { TransactionKind } from './enums'
export {
  TransactionNotFoundError,
  TransactionCategoryNotFoundError,
} from './errors'
export { TransactionRepository } from './repository'
export { TransactionResolver } from './resolvers'
