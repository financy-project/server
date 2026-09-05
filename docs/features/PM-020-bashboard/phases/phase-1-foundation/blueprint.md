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

