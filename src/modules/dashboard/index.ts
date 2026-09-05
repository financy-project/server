// Public API for the 'dashboard' module.
// Only export: entity, types, enums, errors, repository, resolver.
// NEVER export: use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders.
// No entity/errors/repository here (see plan.md's DoR Blueprints — the
// dashboard is a computed read model with no Prisma model of its own).

export type {
  DashboardMovement,
  CategoryBalance,
  DashboardSummary,
} from './types'
export { DashboardResolver } from './resolvers'
