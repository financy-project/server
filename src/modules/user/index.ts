// Public API for the 'user' module.
// Only export: entity, types, enums, errors, repository, resolver.
// NEVER export: use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders.

export { User } from './entity/user.entity'
export type { UserProps, CreateUserProps } from './entity/user.entity'
export { UserRepository } from './repository'
export { UserAlreadyExistsError } from './errors/user-errors'
