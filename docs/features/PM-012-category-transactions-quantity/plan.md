# Category Transactions Quantity - PM-012 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Entity Blueprint

**Omitted:** No new entity and no change to `Category`/`Transaction` entities.
`transactionsQuantity` is a read-only, computed relational field (a count),
not a business rule or state transition on either entity.

### Repository Blueprint

- **Repository Name:** `TransactionRepository` (`src/modules/transaction/repository/transaction.repository.ts`) — existing repository, one new method added.
- **Methods:**
  - `countByCategoryIds(categoryIds: string[]): Promise<Record<string, number>>` — `prisma.transaction.groupBy({ by: ['categoryId'], where: { categoryId: { in: categoryIds } }, _count: { _all: true } })`, reduced into a `{ [categoryId: string]: number }` map. Counts **all** transactions ever created for that category, no date filter (confirmed in grill-me: total historical count, not scoped to a period — matches the spec's literal "how many transactions were made with that category").
- **Data Mapping:** `groupBy` only returns rows for `categoryId` values that have at least one matching transaction — a `categoryId` with zero transactions is simply absent from the result and from the returned map (never `0` in the map itself). The caller (loader, see below) is responsible for defaulting an absent key to `0`. `categoryId: null` rows (transactions with no category) are excluded by the `where` filter as long as the queried `categoryIds` array itself never contains `null` — it won't, since it's always sourced from real `Category.id` values.

### Use-Case Blueprint

**Omitted:** No new use-case and no change to `ListCategoriesUseCase`. This
follows the exact precedent already in this codebase for the mirror-image
relation: `TransactionResolver.category` (`src/modules/transaction/resolvers/transaction.resolver.ts`)
resolves `Transaction.category` directly in a `@FieldResolver`, calling the
loader/gateway inline, with no dedicated use-case layer in between. This
feature's `CategoryResolver.transactionsQuantity` FieldResolver does the same
in the opposite direction.

### GraphQL Blueprint

- **Object Type:** `CategoryType` (`src/modules/category/graphql/object-types/category.object-type.ts`) — add one field:
  ```ts
  @Field(() => Int)
  transactionsQuantity!: number
  ```
  Non-nullable — a category with zero transactions resolves to `0`, never
  `null` (confirmed acceptance criterion in `spec.md`). Declared with `!` the
  same way every other field on this class is, even though — like
  `TransactionType.category` — its actual value is never set by the mapper;
  it's supplied at query time by the `@FieldResolver` below.
- **Input Type / Args Type:** None — no new input, no new query/mutation
  argument. `listCategories` takes no arguments today and continues to take
  none.
- **Resolver Name & Operation:** `CategoryResolver` (`src/modules/category/resolvers/category.resolver.ts`) — change its class decorator from `@Resolver()` to `@Resolver(() => CategoryType)` (required for a `@FieldResolver` to attach to `CategoryType`, mirroring `@Resolver(() => TransactionType)` on `TransactionResolver`), and add:
  ```ts
  @FieldResolver(() => Int)
  async transactionsQuantity(
    @Root() category: CategoryType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<number> {
    return ctx.loaders.transactionsQuantityByCategoryId.load(category.id)
  }
  ```
  No new `@Query`/`@Mutation` — this field resolves on every `CategoryType`
  returned by any existing operation (`listCategories`, `createCategory`,
  `updateCategory`), since it's a type-level field resolver, not tied to one
  operation.
- **Mapper:** `toCategoryType` (`src/modules/category/mappers/category.mapper.ts`) is **not changed** — it never sets `transactionsQuantity`; the `@FieldResolver` supplies it, exactly as `toTransactionType` never sets `TransactionType.category`.
- **DataLoader needed? Yes.** New loader `buildTransactionsQuantityByCategoryIdLoader` (`src/modules/category/loaders/transactions-quantity-by-category-id.loader.ts`), keyed by `Category.id`, batching through the new port/gateway/adapter chain below. Without it, `listCategories { transactionsQuantity }` over N categories would issue N separate count queries.
- **Complexity cost:** Default (no explicit `complexity` option) — a single scalar (`Int`) field resolved via one batched `DataLoader` call, not a list or a deeply-nested object, so the default cost of `1` is appropriate and is being stated explicitly per the DoR rather than left implicit.

### Domain Events Blueprint

**Omitted:** No use-case emits or consumes an event here.

### Cross-Module Port/Adapter/Gateway/Loader Blueprint

This mirrors, in the reverse direction, the exact pattern already built for
PM-004's `Transaction.category` field
(`src/modules/transaction/ports/find-categories-by-ids.port.ts` →
`src/modules/category/adapters/find-categories-by-ids.adapter.ts` →
`src/modules/transaction/gateways/find-categories-by-ids.gateway.ts` →
`src/modules/transaction/loaders/categories-by-id.loader.ts`). There: the
`transaction` module (consumer) owns the port, the `category` module (data
owner) owns the adapter. Here it's reversed: `category` (consumer, since
`CategoryType` owns the new field) owns the port, `transaction` (data owner —
`Transaction` rows are what's being counted) owns the adapter.

- **Port** (owned by `category`, new file `src/modules/category/ports/count-transactions-by-category-ids.port.ts`):
  ```ts
  export type CountTransactionsByCategoryIdsPort = (
    categoryIds: string[],
  ) => Promise<Record<string, number>>
  ```
  Barrel: new `src/modules/category/ports/index.ts` exporting `CountTransactionsByCategoryIdsPort`.
- **Adapter** (owned by `transaction`, new file `src/modules/transaction/adapters/count-transactions-by-category-ids.adapter.ts`):
  ```ts
  export const countTransactionsByCategoryIdsAdapter: CountTransactionsByCategoryIdsPort =
    (categoryIds) => TransactionRepository.countByCategoryIds(categoryIds)
  ```
  Barrel: new `src/modules/transaction/adapters/index.ts` exporting `countTransactionsByCategoryIdsAdapter`. This is the one sanctioned cross-module import: `category`'s gateway imports this directly from `@/modules/transaction/adapters`, same as `transaction`'s gateway today imports `findCategoriesByIdsAdapter` from `@/modules/category/adapters`.
- **Gateway** (owned by `category`, new file `src/modules/category/gateways/count-transactions-by-category-ids.gateway.ts`):
  ```ts
  export const countTransactionsByCategoryIds: CountTransactionsByCategoryIdsPort =
    async (categoryIds) => {
      const uniqueIds = Array.from(new Set(categoryIds))
      if (uniqueIds.length === 0) return {}
      return countTransactionsByCategoryIdsAdapter(uniqueIds)
    }
  ```
  Barrel: new `src/modules/category/gateways/index.ts`. Dedup + empty-array
  short-circuit, same cross-cutting responsibility `findCategoriesByIds`
  already has in the mirror direction.
- **Loader** (owned by `category`, new file `src/modules/category/loaders/transactions-quantity-by-category-id.loader.ts`):
  ```ts
  export const buildTransactionsQuantityByCategoryIdLoader = (): DataLoader<
    string,
    number
  > =>
    new DataLoader<string, number>(async (categoryIds) => {
      const counts = await countTransactionsByCategoryIds([...categoryIds])
      return categoryIds.map((id) => counts[id] ?? 0)
    })
  ```
  Barrel: new `src/modules/category/loaders/index.ts`. This is where an
  absent key from the repository's `groupBy` result becomes `0`.
- **Context wiring** (`src/context/create-context.ts`): add
  `transactionsQuantityByCategoryId: DataLoader<string, number>` to the
  `GraphQLContext['loaders']` type, and
  `transactionsQuantityByCategoryId: buildTransactionsQuantityByCategoryIdLoader()`
  to the object built in `createContext` — built fresh per request, same as
  every other loader here, never a module-level singleton.
- **Ownership/authorization note:** No extra `userId` check is needed in the
  count query. `CreateTransactionUseCase.createTransaction`
  (`src/modules/transaction/use-cases/create-transaction.use-case.ts`)
  already rejects `categoryId`s that don't belong to the transaction's own
  `userId` (throws `TransactionCategoryNotFoundError`) before a `Transaction`
  row can ever be created — so a `Transaction.categoryId` can never point at
  another user's category, and counting by `categoryId` alone can't leak
  cross-user data.

## Architectural Decisions

- **Scope & Requirements:** Add a computed `transactionsQuantity: Int!` field
  to `CategoryType`, counting all-time `Transaction` rows for that category
  (confirmed in grill-me — no date scoping). Success = `listCategories`
  (and any other operation returning `CategoryType`) reports the correct
  count, `0` for an unused category, one query total regardless of how many
  categories are in the result. Out of scope: any change to
  `deleteCategory` behavior, a per-type/per-period breakdown, pagination of
  `listCategories` itself. No backward-compat constraint — purely additive.
- **Data & State:** No new persisted entity, no migration — `Transaction`
  and `Category` tables are unchanged; this only adds a read query
  (`groupBy`) over existing rows.
- **User Experience:** No new failure mode — `transactionsQuantity` cannot
  itself error; it resolves to `0` in the worst case (no matching rows).
  Client ergonomics: non-nullable `Int!`, so client code never needs a null
  check on this field.
- **Testing & Validation:** Unit tests for the new adapter, gateway, and
  loader (mirroring the existing `find-categories-by-ids` trio's test
  style); integration test for `TransactionRepository.countByCategoryIds`
  against a real database (`useDatabase()`); e2e test asserting
  `listCategories { transactionsQuantity }` returns the right numbers,
  including `0` for a category with no transactions.
- **Implementation Details:** Touches both `category` and `transaction`
  modules — this is exactly the kind of cross-module field the isolation
  rule anticipates (see Module Composition below); no direct import between
  modules outside the one sanctioned port/adapter/gateway boundary. New
  relational field → `DataLoader` required (built above). Not a
  list/deeply-nested field → default complexity, stated explicitly.
  `schema.graphql` **does** need regenerating (new field on `CategoryType`).
  No new package dependencies.
- **Security Considerations:** No new auth surface — `transactionsQuantity`
  rides on `listCategories`' existing `requireCurrentUser(ctx)` check via
  `CategoryResolver`; a user can only ever see counts for their own
  categories, since `listCategories` only ever returns that user's
  `Category` rows in the first place. Cross-user leak analysis: see the
  Ownership note above — a `Category`'s count can only include transactions
  already known to belong to the same user because `categoryId` assignment
  is validated at transaction-creation time.
- **Complex Workflows:** Not Applicable — a single batched read query, no
  multi-step process.
- **Cross-Cutting Concerns:** No new logging, caching, or metrics — same
  size/shape as the existing `categoriesById` loader, which has none either.
- **Error Scenarios & Failure Modes:** Database-down affects this the same
  way it affects every other query in this codebase (unhandled, propagates
  as `INTERNAL_SERVER_ERROR` via the existing `formatError` plugin) — no
  special-casing needed. No race condition risk: this is a read-only
  aggregate with no write path of its own.
- **Performance & Scale:** One `groupBy` query per `listCategories` request
  (via the `DataLoader`, however many categories are in the result),
  instead of N — this is the entire point of the loader. No new index
  required: `Transaction.categoryId` is already covered by the existing
  `@@index([userId, date])`'s implicit FK lookup path is not indexed
  separately, but category lists are small (a user's own categories,
  realistically dozens at most) and `categoryId` is a FK with a unique
  constraint backing it on the `Category` side — acceptable for this scale;
  flagged here rather than silently assumed.
- **Module Composition:** Two modules involved (`category`, `transaction`);
  `category` owns `CategoryType` so it owns the resolver/port/gateway/loader
  for this field (per the "module that owns the parent type" rule);
  `transaction` owns the adapter since it owns the underlying data
  (`Transaction` rows). Communication is exclusively through the new
  port/adapter/gateway triple — no direct repository-to-repository or
  resolver-to-resolver import between the two modules.
- **Deployment & Operations:** No database migration. Rollback = revert the
  commit(s); purely additive schema change, safe to roll back without any
  data cleanup. No feature flag — small additive field. No new monitoring.
- **Backward Compatibility:** Additive, non-breaking: a new non-null field
  on an existing type. No existing client query is affected (nobody was
  already selecting a field named `transactionsQuantity`); no field
  removed, renamed, or changed in nullability/type. `schema.graphql`'s diff
  will show only the new field being added to `CategoryType`.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `TransactionRepository.countByCategoryIds(categoryIds: string[]): Promise<Record<string, number>>` to `src/modules/transaction/repository/transaction.repository.ts`, using `prisma.transaction.groupBy({ by: ['categoryId'], where: { categoryId: { in: categoryIds } }, _count: { _all: true } })` reduced into a `{ [categoryId: string]: number }` map (absent categoryIds simply aren't keys in the returned map).
- [ ] Integration test for `TransactionRepository.countByCategoryIds` (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, new `describe` block, using `useDatabase()`): returns the correct count per `categoryId` across multiple categories with different transaction counts; a `categoryId` with zero transactions is absent from the returned map; an empty `categoryIds` input returns `{}`.
- [ ] Implement port `CountTransactionsByCategoryIdsPort` (`src/modules/category/ports/count-transactions-by-category-ids.port.ts`): `export type CountTransactionsByCategoryIdsPort = (categoryIds: string[]) => Promise<Record<string, number>>`; export from new `src/modules/category/ports/index.ts`.
- [ ] Implement adapter `countTransactionsByCategoryIdsAdapter` (`src/modules/transaction/adapters/count-transactions-by-category-ids.adapter.ts`), implementing `CountTransactionsByCategoryIdsPort` via `TransactionRepository.countByCategoryIds`; export from new `src/modules/transaction/adapters/index.ts`.
- [ ] Unit test for the adapter (`src/modules/transaction/__tests__/unit/adapters/count-transactions-by-category-ids-adapter-describe.test.ts`, `TransactionRepository` mocked): delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged.

### Phase 2: Features

- [ ] Implement gateway `countTransactionsByCategoryIds` (`src/modules/category/gateways/count-transactions-by-category-ids.gateway.ts`): dedupes `categoryIds`, returns `{}` for an empty array without calling the adapter, otherwise calls `countTransactionsByCategoryIdsAdapter`; export from new `src/modules/category/gateways/index.ts`.
- [ ] Unit tests for the gateway (`src/modules/category/__tests__/unit/gateways/count-transactions-by-category-ids-gateway-describe.test.ts`, adapter mocked): dedupes ids before calling the adapter; empty input short-circuits without calling the adapter.
- [ ] Implement loader `buildTransactionsQuantityByCategoryIdLoader` (`src/modules/category/loaders/transactions-quantity-by-category-id.loader.ts`): `DataLoader<string, number>` that calls the gateway and maps each input id to `counts[id] ?? 0`, preserving key order; export from new `src/modules/category/loaders/index.ts`.
- [ ] Unit tests for the loader (`src/modules/category/__tests__/unit/loaders/transactions-quantity-by-category-id-loader-describe.test.ts`, gateway mocked): resolves the correct count per id; defaults to `0` for an id absent from the gateway's result map; preserves 1:1 input/output order.
- [ ] Wire the new loader into request context: add `transactionsQuantityByCategoryId: DataLoader<string, number>` to `GraphQLContext['loaders']` and `transactionsQuantityByCategoryId: buildTransactionsQuantityByCategoryIdLoader()` to the object returned by `createContext` in `src/context/create-context.ts`.
- [ ] Add `transactionsQuantity: Int!` field to `CategoryType` (`src/modules/category/graphql/object-types/category.object-type.ts`): `@Field(() => Int) transactionsQuantity!: number` (needs `Int` added to the `type-graphql` import).
- [ ] Change `CategoryResolver`'s class decorator from `@Resolver()` to `@Resolver(() => CategoryType)` and add `@FieldResolver(() => Int) async transactionsQuantity(@Root() category: CategoryType, @Ctx() ctx: GraphQLContext): Promise<number>` returning `ctx.loaders.transactionsQuantityByCategoryId.load(category.id)` (`src/modules/category/resolvers/category.resolver.ts`; needs `FieldResolver`, `Root` added to the `type-graphql` import).

### Phase 3: Polish

- [ ] E2E test for `listCategories { transactionsQuantity }` (`src/modules/category/__tests__/integration/e2e/list-categories-describe.test.ts`, extending the existing `describe` block, using `useDatabase()`): a category with 3 transactions reports `transactionsQuantity: 3`; a category with 0 transactions reports `transactionsQuantity: 0`; two categories in the same `listCategories` response each report their own correct, independent count.
- [ ] Run `pnpm dev` (or any test that builds the schema) to regenerate `schema.graphql`, then commit the resulting diff (expected: only the new `transactionsQuantity: Int!` field added to `CategoryType`, plus the schema's `Int` scalar declaration if not already present).
- [ ] Run `pnpm test` and `pnpm build` and confirm both pass clean.

## Test Cases

### Phase 1: Foundation

- [ ] `TransactionRepository.countByCategoryIds` returns the correct count per `categoryId` across multiple categories
- [ ] `TransactionRepository.countByCategoryIds` — a `categoryId` with zero transactions is absent from the returned map
- [ ] `TransactionRepository.countByCategoryIds` — empty input returns `{}`
- [ ] `countTransactionsByCategoryIdsAdapter` delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged

### Phase 2: Features

- [ ] `countTransactionsByCategoryIds` gateway dedupes ids before calling the adapter
- [ ] `countTransactionsByCategoryIds` gateway — empty input short-circuits without calling the adapter
- [ ] `buildTransactionsQuantityByCategoryIdLoader` resolves the correct count per id
- [ ] `buildTransactionsQuantityByCategoryIdLoader` defaults to `0` for an id absent from the gateway's result map
- [ ] `buildTransactionsQuantityByCategoryIdLoader` preserves 1:1 input/output order

### Phase 3: Polish

- [ ] `listCategories` — a category with 3 transactions reports `transactionsQuantity: 3`
- [ ] `listCategories` — a category with 0 transactions reports `transactionsQuantity: 0`
- [ ] `listCategories` — two categories in the same response each report their own independent count

## Dependencies

- External packages: none new
- Internal: `category` module's new port/gateway/loader depend on
  `transaction` module's new adapter (one-directional, via the adapter
  barrel only — the sanctioned cross-module import point)

## Risks & Mitigations

| Risk                                                                                                                                                | Impact | Mitigation                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupBy`'s "absent means zero" shape is easy to get wrong (e.g. forgetting the `?? 0` default)                                                     | Medium | Dedicated test cases at both the repository layer (absent key) and the loader layer (`?? 0` default) catch this at two points                                                                      |
| Changing `CategoryResolver`'s `@Resolver()` to `@Resolver(() => CategoryType)` could be a breaking TypeGraphQL decorator change if done incorrectly | Low    | Directly mirrors the already-working `@Resolver(() => TransactionType)` pattern on `TransactionResolver`; `pnpm build` + existing category e2e tests catch any schema-build regression immediately |
| Forgetting to regenerate `schema.graphql`                                                                                                           | Low    | Explicit Phase 3 task; `pnpm build`/`pnpm test:e2e` both build the schema and would surface a stale-file diff in review                                                                            |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] New unit tests (adapter, gateway, loader) and integration test (repository) passing
- [ ] New e2e test for `listCategories { transactionsQuantity }` passing
- [ ] `pnpm test` and `pnpm build` pass clean
- [ ] `schema.graphql` regenerated and committed with only the expected additive diff
