# Bashboard - PM-020 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Entity Blueprint

**Omitted:** There is no persisted or identifiable domain concept here — the
dashboard is a computed read model assembled per-request from data already
owned by the `transaction` and `category` modules. The only "business logic"
is arithmetic (`income - expense`, per-category netting) with no invariants,
identity, or state transitions to encapsulate, so it lives as plain
calculation inside the use-case rather than a dedicated Entity class (per
Function-First DDD, plain functions are the default; Entities are the
exception, reserved for things with identity/invariants).

### Enums Blueprint

**Omitted:** No new domain-specific state/value set is introduced. The only
enum involved, `TransactionKind`, already exists in the `transaction` module
and is reused as-is (imported, never redefined).

### Errors Blueprint

**Omitted:** No new domain error class is needed. The only failure mode is
the pre-existing `UnauthenticatedError` (thrown by the shared
`requireCurrentUser(ctx)` helper already used by every other resolver) — the
use-case itself has no failure path of its own since every step is a plain
read scoped by `userId`, with no not-found/conflict/validation outcomes to
model.

### Repository Blueprint

**Omitted (new repository):** The `dashboard` module owns no Prisma model of
its own, so it gets no `repository/` implementation — per "adapter lives
where the data is," aggregation queries over `Transaction` rows belong in
`TransactionRepository` (owned by the `transaction` module), not in a new
module reaching into a table it doesn't own.

**Not omitted (extension to an existing repository):** one new method is
added to the existing `TransactionRepository`
(`src/modules/transaction/repository/transaction.repository.ts`), which is
part of that module's public barrel export (`src/modules/transaction/index.ts`
already exports `TransactionRepository`), so the `dashboard` module's
use-case calls it directly — no new port/adapter/gateway needed, since this
is a one-directional dependency (`dashboard → transaction`), unlike the
existing bidirectional `transaction ↔ category` port/adapter/gateway pair
which exists specifically to avoid a circular direct dependency.

- **Repository:** `TransactionRepository` (extended)
- **New method:** `summarizeForUser(userId: string, range: { startDate: Date; endDate: Date }): Promise<TransactionSummaryRow[]>`
  where
  ```ts
  type TransactionSummaryRow = {
    categoryId: string | null
    type: TransactionKind
    totalValue: number
    count: number
  }
  ```
- **Data Mapping:** built on `prisma.transaction.groupBy({ by: ['categoryId', 'type'], where: { userId, date: { gte: range.startDate, lte: range.endDate } }, _sum: { value: true }, _count: { _all: true } })`, mapped to `TransactionSummaryRow[]` via `totalValue: group._sum.value ?? 0, count: group._count._all`. Reuses the existing `@@index([userId, date])` on `Transaction` — no new index/migration needed.
- **Also reused, unmodified:** `TransactionRepository.findAllByUserId(userId, { startDate: null, endDate: null, description: null, type: null, categoryIds: null }, { first: 5, after: null })` for `recentTransactions` — it already orders by `[{ date: 'desc' }, { id: 'desc' }]`, which is exactly the "most recent by transaction date, `id` as a stable tiebreaker" behavior this feature needs. No new repository method for this part.
- **Also reused, unmodified:** `CategoryRepository.findManyByIds(categoryIds)` (already public on the `category` module's barrel) to resolve `title`/`color` for the categories that appear in `summarizeForUser`'s output.

### Use-Case Blueprint

- **Use-Case Name:** `GetDashboardUseCase`
- **Inputs/Outputs:**
  - Input: `userId: string`
  - Output: `DashboardSummary` (plain type, not a GraphQL type):
    ```ts
    type DashboardMovement = {
      income: number
      expense: number
      totalBalance: number
    }

    type CategoryBalance = {
      categoryId: string
      title: string
      color: string
      transactionCount: number
      totalValue: number
    }

    type DashboardSummary = {
      movement: DashboardMovement
      recentTransactions: Transaction[] // transaction module entity
      balanceByCategory: CategoryBalance[]
    }
    ```
- **Orchestration Steps:**
  1. `const { startDate, endDate } = getCurrentMonthRange()` (reused from `@/shared/utils/date-range` — same util `ListTransactionsUseCase` uses for its `month`/`year` filter, so "current month" means the same thing everywhere in the API).
  2. `const rows = await TransactionRepository.summarizeForUser(userId, { startDate, endDate })`
  3. Compute `movement`: `income = sum of rows where type === INCOME`, `expense = sum of rows where type === EXPENSE`, `totalBalance = income - expense`.
  4. Group `rows` by `categoryId`, **excluding rows where `categoryId === null`**: for each group, `transactionCount = sum of count`, `totalValue = sum of (type === INCOME ? totalValue : -totalValue)`.
  5. `const categoryIds = Object.keys(groupedByCategory)`; if non-empty, `const categories = await CategoryRepository.findManyByIds(categoryIds)`; join each group with its category's `title`/`color` by `id`.
  6. `const { items } = await TransactionRepository.findAllByUserId(userId, { startDate: null, endDate: null, description: null, type: null, categoryIds: null }, { first: 5, after: null })` → `recentTransactions = items`.
  7. Return `{ movement, recentTransactions, balanceByCategory }`.
- **Decision Table:** **Omitted** — no conditional branching alters control flow (step 4's category-null filter is a data exclusion, not a branch with distinct outcomes/errors); this is a linear aggregation pipeline.
- **Emitted Events:** None.

### GraphQL Blueprint

- **Object Types:**

  ```ts
  @ObjectType()
  class DashboardMovementType {
    @Field(() => Int) income!: number
    @Field(() => Int) expense!: number
    @Field(() => Int) totalBalance!: number
  }

  @ObjectType()
  class DashboardCategoryBalanceType {
    @Field(() => ID) categoryId!: string
    @Field() title!: string
    @Field() color!: string
    @Field(() => Int) transactionCount!: number
    @Field(() => Int) totalValue!: number
  }

  @ObjectType()
  class DashboardType {
    @Field(() => DashboardMovementType) movement!: DashboardMovementType
    @Field(() => [TransactionType], { complexity: 3 })
    recentTransactions!: TransactionType[]
    @Field(() => [DashboardCategoryBalanceType], { complexity: 5 })
    balanceByCategory!: DashboardCategoryBalanceType[]
  }
  ```

  `TransactionType` is deep-imported from
  `@/modules/transaction/graphql/object-types/transaction.object-type` —
  mirroring the existing precedent of `auth.resolver.ts`/`auth.mapper.ts`
  deep-importing `UserType` from the `user` module for the exact same
  reason (reusing another module's GraphQL shape for a field this module
  doesn't own the resolver logic for beyond assembly).

- **Input Type / Args Type:** **Omitted** — the `dashboard` query takes no
  arguments; "current month" is always server-computed `now()`, never
  client-supplied (per spec, out of scope). No `class-validator` surface
  needed.
- **Resolver Name & Operation:** `DashboardResolver.dashboard` —
  `@Query(() => DashboardType, { complexity: 6 })`
  `async dashboard(@Ctx() ctx: GraphQLContext): Promise<DashboardType>`
- **Mapper:** New — `toDashboardType(summary: DashboardSummary): DashboardType`
  in the `dashboard` module. It builds `recentTransactions` items itself via
  a **locally-defined** `toRecentTransactionType(transaction: Transaction): TransactionType`
  (same field assignments as `transaction`'s own `toTransactionType`, incl.
  setting the plain `categoryId` property so the existing `category`
  `@FieldResolver` on `TransactionResolver` has something to key off) —
  again mirroring `auth.mapper.ts`'s `toAuthenticatedUserType`, which
  re-implements its own mapping rather than importing `user`'s mapper
  (mappers are never part of a module's public barrel).
- **DataLoader needed?** **No new loader.** `recentTransactions[].category`
  is resolved automatically by the existing `TransactionResolver.category`
  `@FieldResolver` (bound to the `TransactionType` class itself, not to the
  `listTransactions` query) via the existing `ctx.loaders.categoriesById`
  DataLoader — this fires for any `TransactionType` instance returned by
  any resolver, as long as `categoryId` is set on it, which the dashboard's
  own mapper does.
- **Complexity cost:** `dashboard` query: `6` (three sub-aggregates, bounded
  work). `recentTransactions`: `3` (fixed cap of 5 items — cheap but
  non-trivial since each item can trigger the `category` FieldResolver's
  own `complexity: 2`). `balanceByCategory`: `5` (unbounded by a hard limit,
  though practically bounded by how many categories a user has — closer to
  `listTransactions`' `12` than to a single scalar). `movement`: default
  (single nested object of scalars, no cost declared).

### Domain Events Blueprint

**Omitted:** This feature emits and consumes no domain events — it's a pure
read aggregation.

---

## Architectural Decisions

- **Scope & Requirements:** One new query, `dashboard`, returning
  `movement` + `recentTransactions` + `balanceByCategory` for the
  requesting user's current calendar month (server-computed). No
  client-supplied date range. See `spec.md` for full acceptance criteria.
- **Data & State:** No new persisted records — this is a read-only
  aggregate over existing `Transaction`/`Category` rows. Nothing is
  created, modified, or retained beyond what `transaction`/`category`
  already own.
- **User Experience:** Happy path: authenticated client sends `{ dashboard { movement { income expense totalBalance } recentTransactions { id type value date category { title color } } balanceByCategory { title color transactionCount totalValue } } }` and gets one response instead of three round-trips. Unauthenticated: `UnauthenticatedError` → `extensions.code: 'UNAUTHENTICATED'` (same as every other authenticated query, via `requireCurrentUser(ctx)`). No other failure mode exists — there's no user input to reject.
- **Testing & Validation:**
  - Unit: `GetDashboardUseCase` with mocked `TransactionRepository`/`CategoryRepository` — covers the aggregation math and edge cases (see Test Cases).
  - Integration: new `summarizeForUser` describe block added to the existing `transaction-repository-describe.test.ts` (real Postgres via `useDatabase()`), asserting the groupBy math against seeded rows.
  - E2E: real `dashboard { ... }` operation via `buildTestSchema()` — happy path, empty-month path, and unauthenticated path asserting `errors[0].extensions.code === 'UNAUTHENTICATED'`.
  - No security test beyond auth — there's no per-record ownership check to bypass since every repository call is scoped by `userId` already (no id-based lookups a user could substitute another user's id into).
- **Implementation Details:** Touches `transaction` module (new repository method only), `category` module (no changes — reuses existing public `findManyByIds`), and a new `dashboard` module (types, GraphQL object types, use-case, mapper, resolver). No new npm dependencies. `schema.graphql` must be regenerated and committed (new `dashboard` query + 3 new object types). DataLoader/complexity: see GraphQL Blueprint above.
- **Security Considerations:** Standard cookie-based JWT auth via `requireCurrentUser(ctx)` — identical mechanism to every other query in this codebase. No new secrets, no password/token handling. No timing-sensitive comparisons (nothing to enumerate — a missing/invalid session just throws `UnauthenticatedError`, same for every user). Query complexity budget (see above) prevents this new query from being an outsized cost relative to `listTransactions`.
- **Complex Workflows:** Not Applicable — single synchronous read, no multi-step/async/saga behavior.
- **Cross-Cutting Concerns:** No new logging beyond whatever request-level logging Apollo already does (gated behind `NODE_ENV !== 'test'` per existing convention). No caching — this is cheap enough (two indexed queries) that adding a TTL cache would be premature for the current scale, and the spec explicitly puts caching out of scope. No new metrics beyond the existing per-operation ones Apollo/complexity-plugin already emit.
- **Error Scenarios & Failure Modes:** Database-down / Prisma errors propagate unmodified and are handled by the same generic Apollo `formatError` path as every other query — no bespoke handling needed since there's no partial-failure state to roll back (single read, no writes). No race conditions possible (read-only). No retry/timeout logic beyond whatever Prisma's connection pool already does globally.
- **Performance & Scale:** Two indexed queries per request (`groupBy` on `[userId, date]`, and the existing `findAllByUserId` for the top-5) plus a bounded `findManyByIds` for categories — no N+1 risk since `balanceByCategory` categories are batch-fetched once, not per-row. No pagination on `recentTransactions` (fixed 5) or `balanceByCategory` (bounded by the user's own category count, realistically small) — matches spec's explicit out-of-scope call.
- **Module Composition:** New `dashboard` module, composing `transaction` and `category` via their **public repository exports** (already part of both modules' barrels — see `src/modules/transaction/index.ts` / `src/modules/category/index.ts`), not via a new ports/adapters/gateways pair. That machinery exists in this codebase specifically for _bidirectional_ module needs (`transaction` needs categories, `category` needs transaction counts) to avoid a circular direct dependency; `dashboard → transaction` and `dashboard → category` are both one-directional, so a direct repository import is the simpler, already-sanctioned pattern (same shape as `auth → user`). `dashboard` owns the resolver for `dashboard.recentTransactions`/`balanceByCategory` since it's the parent type's module, even though the underlying data is fetched via other modules' repositories.
- **Deployment & Operations:** No database migration — no new Prisma model/column, reuses the existing `@@index([userId, date])`. No feature flag — additive, non-breaking new query. Rollback is a plain revert (no data written, nothing to migrate back). Standard deploy.
- **Backward Compatibility:** Purely additive — new query, new types, zero changes to `listTransactions`, `listCategories`, or any existing field's shape/nullability. No `@deprecated` concerns.

## Implementation Phases

### Phase 1: Foundation

- [ ] Scaffold the `dashboard` module: `node scripts/scaffold-module.js dashboard` (creates `src/modules/dashboard/` with the standard directory skeleton and barrel stubs)
- [ ] Define `src/modules/dashboard/types/dashboard.types.ts`: `DashboardMovement` (`income: number`, `expense: number`, `totalBalance: number`), `CategoryBalance` (`categoryId: string`, `title: string`, `color: string`, `transactionCount: number`, `totalValue: number`), `DashboardSummary` (`movement: DashboardMovement`, `recentTransactions: Transaction[]`, `balanceByCategory: CategoryBalance[]`) — `Transaction` imported as `import type { Transaction } from '@/modules/transaction'`
- [ ] Add `summarizeForUser` to `src/modules/transaction/repository/transaction.repository.ts`: `summarizeForUser(userId: string, range: { startDate: Date; endDate: Date }): Promise<TransactionSummaryRow[]>` where `TransactionSummaryRow = { categoryId: string | null; type: TransactionKind; totalValue: number; count: number }`, implemented via `prisma.transaction.groupBy({ by: ['categoryId', 'type'], where: { userId, date: { gte: range.startDate, lte: range.endDate } }, _sum: { value: true }, _count: { _all: true } })` mapped to `{ categoryId, type: group.type as TransactionKind, totalValue: group._sum.value ?? 0, count: group._count._all }`; export `TransactionSummaryRow` alongside `TransactionRepository` from `src/modules/transaction/repository/index.ts`
- [ ] Integration tests: new `describe('summarizeForUser', ...)` block appended to `src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts` — cases: returns one row per distinct `(categoryId, type)` pair within range; excludes transactions outside `[startDate, endDate]`; excludes other users' transactions; includes a `categoryId: null` row for uncategorized transactions; returns `[]` when the user has no transactions in range

### Phase 2: Features

- [ ] `GetDashboardUseCase.getDashboard(userId: string): Promise<DashboardSummary>` in `src/modules/dashboard/use-cases/get-dashboard.use-case.ts`, implementing the 7 orchestration steps in the Use-Case Blueprint above (`getCurrentMonthRange()` from `@/shared/utils/date-range`, `TransactionRepository.summarizeForUser`, in-memory grouping/netting, `CategoryRepository.findManyByIds`, `TransactionRepository.findAllByUserId` for the top 5)
- [ ] Unit tests for `GetDashboardUseCase` in `src/modules/dashboard/__tests__/unit/use-cases/get-dashboard-describe.test.ts` (mocked `TransactionRepository`/`CategoryRepository`) — see Test Cases below for the full case list
- [ ] GraphQL object types in `src/modules/dashboard/graphql/object-types/`: `dashboard-movement.object-type.ts` (`DashboardMovementType`: `income`/`expense`/`totalBalance`, all `@Field(() => Int)`), `dashboard-category-balance.object-type.ts` (`DashboardCategoryBalanceType`: `categoryId` `@Field(() => ID)`, `title`/`color` `@Field()`, `transactionCount`/`totalValue` `@Field(() => Int)`), `dashboard.object-type.ts` (`DashboardType`: `movement` `@Field(() => DashboardMovementType)`, `recentTransactions` `@Field(() => [TransactionType], { complexity: 3 })` importing `TransactionType` from `@/modules/transaction/graphql/object-types/transaction.object-type`, `balanceByCategory` `@Field(() => [DashboardCategoryBalanceType], { complexity: 5 })`); barrel `src/modules/dashboard/graphql/object-types/index.ts` exports all three
- [ ] `toDashboardType(summary: DashboardSummary): DashboardType` in `src/modules/dashboard/mappers/dashboard.mapper.ts`, including a local `toRecentTransactionType(transaction: Transaction): TransactionType` (sets `id`, `type`, `description`, `date`, `value`, `categoryId` — same shape as `transaction`'s own `toTransactionType`, re-implemented locally per the `auth.mapper.ts` precedent, not imported)
- [ ] `DashboardResolver` in `src/modules/dashboard/resolvers/dashboard.resolver.ts`: `@Resolver(() => DashboardType) class DashboardResolver { @Query(() => DashboardType, { complexity: 6 }) async dashboard(@Ctx() ctx: GraphQLContext): Promise<DashboardType> { const { id: userId } = requireCurrentUser(ctx); const summary = await GetDashboardUseCase.getDashboard(userId); return toDashboardType(summary) } }`
- [ ] Register `DashboardResolver` in `src/schema/build-schema.ts`'s `resolvers` array (import from `@/modules/dashboard`)
- [ ] Update `src/modules/dashboard/index.ts` barrel to export `DashboardResolver` from `./resolvers` (per the "only export entity/types/enums/errors/repository/resolver" convention — no entity/errors/repository here, so it exports `types` and `resolvers` only)
- [ ] E2E test in `src/modules/dashboard/__tests__/integration/e2e/dashboard-describe.test.ts` via `buildTestSchema()` — see Test Cases below

### Phase 3: Polish

- [ ] Regenerate `schema.graphql` (`pnpm build` or `pnpm dev` triggers `buildAppSchema()`'s `emitSchemaFile`) and commit the diff (new `dashboard` query, `DashboardType`, `DashboardMovementType`, `DashboardCategoryBalanceType`)
- [ ] Run `/architecture-audit src/modules/dashboard` and fix any flagged deviations
- [ ] Verify `pnpm test --testPathPatterns=dashboard` and the updated `transaction-repository-describe.test.ts` all pass, then full `pnpm test`

## Test Cases

### Phase 1: Foundation

- [ ] `TransactionRepository.summarizeForUser` returns one row per `(categoryId, type)` pair with correct `totalValue`/`count` within the given range
- [ ] `TransactionRepository.summarizeForUser` excludes transactions with `date` outside `[startDate, endDate]`
- [ ] `TransactionRepository.summarizeForUser` excludes another user's transactions
- [ ] `TransactionRepository.summarizeForUser` includes a `categoryId: null` row for uncategorized transactions in range
- [ ] `TransactionRepository.summarizeForUser` returns `[]` for a user with no transactions in range

### Phase 2: Features

- [ ] `GetDashboardUseCase.getDashboard` computes `movement.income`/`expense`/`totalBalance` correctly from mixed `INCOME`/`EXPENSE` summary rows
- [ ] `GetDashboardUseCase.getDashboard` returns `movement` all-zero when `summarizeForUser` returns `[]`
- [ ] `GetDashboardUseCase.getDashboard` nets `totalValue` per category (`INCOME` adds, `EXPENSE` subtracts) and sums `transactionCount` across both types for that category
- [ ] `GetDashboardUseCase.getDashboard` excludes the `categoryId: null` group from `balanceByCategory`
- [ ] `GetDashboardUseCase.getDashboard` omits categories with no rows this month (i.e., never invents a zero-value entry)
- [ ] `GetDashboardUseCase.getDashboard` returns `recentTransactions` from `TransactionRepository.findAllByUserId`'s `items` unmodified (capped at 5, ordered by the repository's existing `date desc, id desc`)
- [ ] `dashboard` query (e2e) happy path: authenticated user with current-month activity gets correct `movement`, 5 `recentTransactions` with resolved `category`, and correct `balanceByCategory`
- [ ] `dashboard` query (e2e) empty-month path: authenticated user with no transactions this month gets `movement: { income: 0, expense: 0, totalBalance: 0 }` and `balanceByCategory: []` (but `recentTransactions` may still be non-empty from a prior month)
- [ ] `dashboard` query (e2e) unauthenticated: `errors[0].extensions.code === 'UNAUTHENTICATED'`

## Dependencies

- **External:** None — no new npm packages.
- **Internal:** `transaction` module (`TransactionRepository`, `TransactionKind`, `TransactionType`, `Transaction` entity — all via existing public exports or the sanctioned deep-import precedent), `category` module (`CategoryRepository` via its public barrel), `@/shared/utils/date-range` (`getCurrentMonthRange`), `@/shared/utils` (`requireCurrentUser`).

## Risks & Mitigations

| Risk                                                                                                                                                     | Impact | Mitigation                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `summarizeForUser`'s `groupBy` miscounts if `_sum.value` is `null` for an empty group                                                                    | Low    | Explicit `?? 0` fallback in the mapping step; covered by the "returns `[]` for no transactions" integration test     |
| Deep-importing `TransactionType`/re-implementing a local mapper drifts from `transaction`'s own `toTransactionType` if that module's shape changes later | Medium | Same risk already accepted by the existing `auth → user` precedent in this codebase; no new pattern introduced       |
| Forgetting to regenerate `schema.graphql` before merge                                                                                                   | Low    | Called out explicitly in Phase 3 and in Success Criteria below; CI/`/architecture-audit` should catch a stale schema |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] All Test Cases above passing (`pnpm test --testPathPatterns=dashboard` and the extended `transaction-repository-describe.test.ts`)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` regenerated and committed with the new `dashboard` query and its 3 object types
