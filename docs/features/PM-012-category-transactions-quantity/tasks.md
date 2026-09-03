# Category Transactions Quantity - PM-012 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 1: Foundation

- [x] B-001: Add `TransactionRepository.countByCategoryIds(categoryIds: string[]): Promise<Record<string, number>>` to `src/modules/transaction/repository/transaction.repository.ts`, using `prisma.transaction.groupBy({ by: ['categoryId'], where: { categoryId: { in: categoryIds } }, _count: { _all: true } })` reduced into a `{ [categoryId: string]: number }` map (absent categoryIds simply aren't keys in the returned map).
- [x] B-002: Integration test for `TransactionRepository.countByCategoryIds` (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, new `describe` block, using `useDatabase()`): returns the correct count per `categoryId` across multiple categories with different transaction counts; a `categoryId` with zero transactions is absent from the returned map; an empty `categoryIds` input returns `{}`.
- [x] B-003: Implement port `CountTransactionsByCategoryIdsPort` (`src/modules/category/ports/count-transactions-by-category-ids.port.ts`): `export type CountTransactionsByCategoryIdsPort = (categoryIds: string[]) => Promise<Record<string, number>>`; export from new `src/modules/category/ports/index.ts`.
- [x] B-004: Implement adapter `countTransactionsByCategoryIdsAdapter` (`src/modules/transaction/adapters/count-transactions-by-category-ids.adapter.ts`), implementing `CountTransactionsByCategoryIdsPort` via `TransactionRepository.countByCategoryIds`; export from new `src/modules/transaction/adapters/index.ts`.
- [x] B-005: Unit test for the adapter (`src/modules/transaction/__tests__/unit/adapters/count-transactions-by-category-ids-adapter-describe.test.ts`, `TransactionRepository` mocked): delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged.

## Phase 2: Features

- [x] B-006: Implement gateway `countTransactionsByCategoryIds` (`src/modules/category/gateways/count-transactions-by-category-ids.gateway.ts`): dedupes `categoryIds`, returns `{}` for an empty array without calling the adapter, otherwise calls `countTransactionsByCategoryIdsAdapter`; export from new `src/modules/category/gateways/index.ts`.
- [x] B-007: Unit tests for the gateway (`src/modules/category/__tests__/unit/gateways/count-transactions-by-category-ids-gateway-describe.test.ts`, adapter mocked): dedupes ids before calling the adapter; empty input short-circuits without calling the adapter.
- [ ] B-008: Implement loader `buildTransactionsQuantityByCategoryIdLoader` (`src/modules/category/loaders/transactions-quantity-by-category-id.loader.ts`): `DataLoader<string, number>` that calls the gateway and maps each input id to `counts[id] ?? 0`, preserving key order; export from new `src/modules/category/loaders/index.ts`.
- [ ] B-009: Unit tests for the loader (`src/modules/category/__tests__/unit/loaders/transactions-quantity-by-category-id-loader-describe.test.ts`, gateway mocked): resolves the correct count per id; defaults to `0` for an id absent from the gateway's result map; preserves 1:1 input/output order.
- [ ] B-010: Wire the new loader into request context: add `transactionsQuantityByCategoryId: DataLoader<string, number>` to `GraphQLContext['loaders']` and `transactionsQuantityByCategoryId: buildTransactionsQuantityByCategoryIdLoader()` to the object returned by `createContext` in `src/context/create-context.ts`.
- [ ] B-011: Add `transactionsQuantity: Int!` field to `CategoryType` (`src/modules/category/graphql/object-types/category.object-type.ts`): `@Field(() => Int) transactionsQuantity!: number` (needs `Int` added to the `type-graphql` import).
- [ ] B-012: Change `CategoryResolver`'s class decorator from `@Resolver()` to `@Resolver(() => CategoryType)` and add `@FieldResolver(() => Int) async transactionsQuantity(@Root() category: CategoryType, @Ctx() ctx: GraphQLContext): Promise<number>` returning `ctx.loaders.transactionsQuantityByCategoryId.load(category.id)` (`src/modules/category/resolvers/category.resolver.ts`; needs `FieldResolver`, `Root` added to the `type-graphql` import).

## Phase 3: Polish

- [ ] B-013: E2E test for `listCategories { transactionsQuantity }` (`src/modules/category/__tests__/integration/e2e/list-categories-describe.test.ts`, extending the existing `describe` block, using `useDatabase()`): a category with 3 transactions reports `transactionsQuantity: 3`; a category with 0 transactions reports `transactionsQuantity: 0`; two categories in the same `listCategories` response each report their own correct, independent count.
- [ ] B-014: Run `pnpm dev` (or any test that builds the schema) to regenerate `schema.graphql`, then commit the resulting diff (expected: only the new `transactionsQuantity: Int!` field added to `CategoryType`, plus the schema's `Int` scalar declaration if not already present).
- [ ] B-015: Run `pnpm test` and `pnpm build` and confirm both pass clean.
