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

