# Category in Transaction - PM-017 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Types & Enums Blueprint

**Omitted:** No new enum or named domain type. The two additions are new
fields on an existing DTO (`CategoryDTO`) and existing GraphQL types
(`TransactionCategoryType`, `TransactionConnection`), not new shapes.

### Entity Blueprint

**Omitted:** Neither `Transaction` nor `Category` gains a new property,
method, or business rule. Both requirements are query-shape/response-shape
concerns (what's returned, and a count), not changes to what either entity
_is_ or how it behaves.

### Errors & Error Families Blueprint

**Omitted:** No new failure mode. Widening `TransactionCategoryType` and
adding `totalRecord` cannot fail independently of the existing
`listTransactions` query — the same errors (auth, validation) apply
unchanged; no new domain error class is needed.

### Repository Blueprint

- **Repository Name:** `TransactionRepository` (`src/modules/transaction/repository/transaction.repository.ts`) — existing `findAllByUserId` extended (no new method).
- **Methods:**
  - `findAllByUserId(userId, filter, pagination)` — return type extended from `{ items, hasNextPage, endCursor }` to:
    ```ts
    type PaginatedTransactions = {
      items: Transaction[]
      hasNextPage: boolean
      endCursor: string | null
      totalRecord: number
    }
    ```
    `filter`/`pagination` parameter shapes are unchanged from PM-015.
- **Data Mapping:** the `where` clause construction (the four conditional branches: date range, `description`, `type`, `categoryIds`) is extracted into a local `baseWhere` object built once, **excluding** the cursor `OR` branch. `findMany` uses `{ ...baseWhere, ...(cursor ? { OR: [...] } : {}) }` as today; a sibling `prisma.transaction.count({ where: baseWhere })` call runs alongside it via `Promise.all`, so `totalRecord` reflects every row matching the request's filters — independent of `first`/`after` — while `items`/`hasNextPage`/`endCursor` are computed exactly as before from the `findMany` result. `userId` stays the leading condition on `baseWhere`, so `totalRecord` is scoped to the requesting user exactly like `items` is.
- **Category data (via the transaction module's existing port/adapter/gateway, not a new repository):**
  - **Port:** `CategoryDTO` (`src/modules/transaction/ports/find-categories-by-ids.port.ts`) gains two fields:
    ```ts
    export type CategoryDTO = {
      id: string
      userId: string
      title: string
      description: string | null
      icon: string
      color: string
    }
    ```
  - **Adapter:** `findCategoriesByIdsAdapter` (`src/modules/category/adapters/find-categories-by-ids.adapter.ts`, owned by the `category` module per "adapter lives where the data is") maps `description` and `icon` from the `Category` entities `CategoryRepository.findManyByIds` already returns — no `CategoryRepository` change needed, those fields are already selected.
  - **Gateway** (`src/modules/transaction/gateways/find-categories-by-ids.gateway.ts`) and **loader** (`src/modules/transaction/loaders/categories-by-id.loader.ts`) are unchanged — both are already generic over `CategoryDTO`.

### Use-Case Blueprint

- **Use-Case Name:** `ListTransactionsUseCase.listTransactions` (existing, `src/modules/transaction/use-cases/list-transactions.use-case.ts`).
- **Inputs/Outputs:** input type unchanged (still PM-015's shape). Output extended:
  ```ts
  type ListTransactionsResult = {
    items: Transaction[]
    hasNextPage: boolean
    endCursor: string | null
    totalRecord: number
  }
  ```
- **Orchestration Steps:** unchanged — (1) resolve `{ startDate, endDate }` per PM-015's Decision Table, (2) call `TransactionRepository.findAllByUserId(...)` and return its result directly. Since the function already returns the repository call's result as-is (no destructuring), no runtime logic changes — only the `ListTransactionsResult` type block above, so `totalRecord` type-checks through.
- **Decision Table:** unchanged from PM-015 (period resolution) — not repeated here, no new branching introduced by this feature.
- **Emitted Events:** none — read-only query, no state change.

### GraphQL Blueprint

- **Object Type(s):**
  - `TransactionCategoryType` (`src/modules/transaction/graphql/object-types/transaction-category.object-type.ts`) gains two fields, appended after the existing `color` field:
    ```ts
    @Field(() => String, { nullable: true })
    description?: string | null

    @Field()
    icon!: string
    ```
  - `TransactionConnection` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`) gains one field, sibling to `edges`/`pageInfo`:
    ```ts
    @Field(() => Int)
    totalRecord!: number
    ```
    (`Int` needs adding to the existing `type-graphql` import.)
- **Input Type / Args Type:** none — `listTransactions`'s `ListTransactionsArgs` is unchanged, this feature adds no new filter/argument.
- **Resolver Name & Operation:** `TransactionResolver.listTransactions` (`@Query(() => TransactionConnection, ...)`) and `TransactionResolver.category` (`@FieldResolver(() => TransactionCategoryType, ...)`) — **no body changes to either.** Both already return whatever their mapper produces (`toTransactionConnection(result)` / `toTransactionCategoryType(category)`), so once the mappers are updated (below) the new fields flow through unchanged. The only resolver-file edit is bumping `listTransactions`'s declared `complexity` (see Complexity cost below).
- **Mapper:**
  - `toTransactionCategoryType` (`src/modules/transaction/mappers/transaction.mapper.ts`) updated to also map `description` and `icon` from the `CategoryDTO` it receives.
  - `toTransactionConnection` (`src/modules/transaction/mappers/transaction-connection.mapper.ts`) updated to set `connection.totalRecord = result.totalRecord`; its local `PaginatedTransactions` type gains `totalRecord: number`.
- **DataLoader needed? No.** `category` already resolves through `buildCategoriesByIdLoader` (`src/modules/transaction/loaders/categories-by-id.loader.ts`) — widening the DTO it batches doesn't add a new relation or a new loader.
- **Complexity cost:** `listTransactions`'s declared `complexity` moves from `10` to `12` — `findAllByUserId` now issues two DB queries per call (`findMany` + `count`) instead of one, so its cost budget is bumped to reflect that, stated explicitly per the DoR rather than left at its old value. `category`'s `@FieldResolver` complexity (`2`) is unchanged — the `DataLoader` batch call gains two more selected columns, not a new query.

### Domain Events Blueprint

**Omitted:** No use-case emits or consumes an event here — read-only query, same as PM-015.

## Architectural Decisions

- **Scope & Requirements:** (1) `TransactionCategoryType.category` gains `description`/`icon`, giving clients the full category object (`id`, `title`, `description`, `icon`, `color`) without a follow-up query. (2) `TransactionConnection` gains `totalRecord: Int!` — the total count of transactions matching the request's filters, independent of `first`/`after`, so a client can compute total pages or drive a full paginated export. Success = both fields populate correctly across every existing filter combination from PM-015, and `totalRecord` never leaks another user's count. Out of scope (per `spec.md`): `transactionsQuantity` (the category module's own aggregate) is **not** added to the embedded category object — different concern, already exposed via `listCategories`; no changes to `listCategories` itself; cursor pagination mechanics (`first`/`after`/`hasNextPage`/`endCursor`) are untouched — `totalRecord` is purely additive.
- **Data & State:** No new persisted entity, no migration. `Transaction`/`Category` rows are unchanged — this only widens two read paths (a DTO's field list, and an added `COUNT` query).
- **User Experience:** Happy path — `listTransactions` responses now include `category.description`/`category.icon` (when a category exists; `category` itself still resolves `null` when it doesn't) and `totalRecord`. No new error paths: existing sad paths (`BAD_USER_INPUT` for date/period validation, from PM-015) are untouched, since no new argument or validation is introduced.
- **Testing & Validation:** Unit tests for `findCategoriesByIdsAdapter`'s widened mapping, `toTransactionCategoryType`'s widened mapping, a new `toTransactionConnection` mapper test (`totalRecord` pass-through), and `ListTransactionsUseCase.listTransactions`'s `totalRecord` pass-through (all mocked/pure). Integration tests for `TransactionRepository.findAllByUserId`'s `totalRecord` against a real database — filtered count vs. page size, per-filter correctness, per-user scoping. E2E tests asserting `listTransactions` returns the full `category` object and a correct `totalRecord` across pages and filters, including the cross-user isolation case.
- **Implementation Details:** Touches the `transaction` module (`ports`, `repository`, `graphql/object-types`, `mappers`, `resolvers`) and the `category` module (`adapters` only — the one sanctioned cross-module import point, unchanged pattern from PM-015). No new package dependencies — `Prisma.transaction.count()` and `Promise.all` are already available. No relational field added → no new `DataLoader`. `listTransactions`'s `complexity` moves `10` → `12` (see GraphQL Blueprint). `schema.graphql` **does** need regenerating (`TransactionCategoryType` gains `description`/`icon`; `TransactionConnection` gains `totalRecord`).
- **Security Considerations:** No new auth surface — both changes ride on `listTransactions`'/`category`'s existing `requireCurrentUser(ctx)` check and existing `userId` scoping. `totalRecord`'s `count()` query reuses the same `baseWhere` (led by `userId`) as `items`, so it can only ever undercount to zero for another user's data, never leak a cross-user total. `description`/`icon` are already client-visible elsewhere (the `category` module's own `CategoryType`) — no new PII or sensitive data introduced.
- **Complex Workflows:** Not Applicable — a single read query plus one additional `count()` query, both synchronous reads, no multi-step process.
- **Cross-Cutting Concerns:** No new logging, caching, or metrics — consistent with `listTransactions` today, which has none of its own beyond whatever global request logging already exists.
- **Error Scenarios & Failure Modes:** Database-down affects the new `count()` call the same as `findMany` — unhandled, propagates as `INTERNAL_SERVER_ERROR` via the existing `formatError` plugin, no special-casing. `findMany` and `count()` run via `Promise.all` as two independent, non-transactional reads — under concurrent writes between the two, `totalRecord` could in principle differ from what a snapshot-consistent read would show by a row or two; this is the same class of non-transactional-read tradeoff already accepted elsewhere in this codebase (e.g. `countByCategoryIds`), not a new risk category, and not worth a DB transaction for a read-only list endpoint. No retry/timeout strategy beyond what already exists globally.
- **Performance & Scale:** Adds one extra `COUNT(*)` query per `listTransactions` call (now two DB round-trips instead of one). Acceptable at this feature's expected scale — same reasoning as PM-015's plan (a single user's own transactions, realistically hundreds to low thousands of rows) — and the `count()` reuses the exact same `where` conditions `findMany` already relies on, so no new indexes are required beyond what PM-015 already flagged (`description`'s `contains` search is unindexed by design, out of scope here too). Complexity bumped `10` → `12` to reflect the added query, per the GraphQL Blueprint.
- **Module Composition:** Still a single "owning" module (`transaction`) for both the resolver and the new `totalRecord` field. Category data continues to cross module boundaries only through the existing port/adapter/gateway (`CategoryDTO` / `findCategoriesByIdsAdapter` / `findCategoriesByIds` gateway) — extended, not replaced. No direct import from `transaction` into the `category` module's repository, consistent with module isolation.
- **Deployment & Operations:** No database migration. Rollback = revert the commit(s) — both changes are purely additive (new object-type fields, wider DTO, wider repository return type); safe to roll back without data cleanup. No feature flag — small additive change to two already-shipped read paths. No new monitoring beyond what already exists for `listTransactions`.
- **Backward Compatibility:** Additive only. `TransactionCategoryType.description` is nullable (matches `Category.description`'s own nullability) and `icon` is non-null (matches `Category.icon`, always set) — no existing field's type or nullability changes. `TransactionConnection.totalRecord` is a brand-new non-null field (`Int!`) — always populated by the resolver (backed by the new `count()` call), so there's no null-vs-undefined ambiguity for clients adopting it. No field removed, renamed, or re-typed; existing clients querying only the old field set are unaffected.

## Implementation Phases

### Phase 1: Foundation

- [ ] Extend `CategoryDTO` (`src/modules/transaction/ports/find-categories-by-ids.port.ts`) to add `description: string | null` and `icon: string`, per the Repository Blueprint's port shape above.
- [ ] Extend `findCategoriesByIdsAdapter` (`src/modules/category/adapters/find-categories-by-ids.adapter.ts`) to map `description` and `icon` from `CategoryRepository.findManyByIds`'s `Category` entities into the returned `CategoryDTO[]`.
- [ ] Unit tests for `findCategoriesByIdsAdapter`'s widened mapping (`src/modules/category/__tests__/unit/adapters/find-categories-by-ids-adapter-describe.test.ts`, extend the existing test): mapped result includes `description` (both a string value and a `null` value across the two fixture categories already in the test) and `icon` alongside the existing `id`/`userId`/`title`/`color`.
- [ ] Extend `TransactionRepository.findAllByUserId` (`src/modules/transaction/repository/transaction.repository.ts`) to also return `totalRecord: number`, per the Repository Blueprint above: extract the four conditional `where` branches into a `baseWhere` built once (excluding the cursor `OR`), run `prisma.transaction.findMany({ where: { ...baseWhere, ...(cursor ? { OR: [...] } : {}) }, ... })` and `prisma.transaction.count({ where: baseWhere })` via `Promise.all`, return `{ items, hasNextPage, endCursor, totalRecord }`.
- [ ] Integration tests for `TransactionRepository.findAllByUserId`'s `totalRecord` (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, new `describe('totalRecord')` block nested under the existing `findAllByUserId` describe): `totalRecord` equals the full filtered-match count when `first` is smaller than the match count (e.g. 5 matching transactions, `first: 2` → `totalRecord: 5`, `items` length 2, `hasNextPage: true`); `totalRecord` respects `description`/`type`/`categoryIds`/date-range filters (only counts matches, not the user's full transaction count); `totalRecord` is scoped to `userId` (another user's matching transactions aren't counted).

### Phase 2: Features

- [ ] Add `description` and `icon` fields to `TransactionCategoryType` (`src/modules/transaction/graphql/object-types/transaction-category.object-type.ts`): `@Field(() => String, { nullable: true }) description?: string | null` and `@Field() icon!: string`, appended after the existing `color` field.
- [ ] Add `totalRecord` field to `TransactionConnection` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`): `@Field(() => Int) totalRecord!: number`, adding `Int` to the existing `type-graphql` import.
- [ ] Update `toTransactionCategoryType` (`src/modules/transaction/mappers/transaction.mapper.ts`) to also map `description` and `icon` from the `CategoryDTO` argument.
- [ ] Update `toTransactionConnection` (`src/modules/transaction/mappers/transaction-connection.mapper.ts`) to set `connection.totalRecord = result.totalRecord`; extend its local `PaginatedTransactions` type with `totalRecord: number`.
- [ ] Extend `ListTransactionsUseCase`'s `ListTransactionsResult` type (`src/modules/transaction/use-cases/list-transactions.use-case.ts`) to add `totalRecord: number`, per the Use-Case Blueprint (no body change needed).
- [ ] Unit tests: extend `toTransactionCategoryType`'s test (`src/modules/transaction/__tests__/unit/mappers/transaction-mapper-describe.test.ts`) asserting `description` (including a `null` case) and `icon` are mapped; add `src/modules/transaction/__tests__/unit/mappers/transaction-connection-mapper-describe.test.ts` asserting `toTransactionConnection` maps `totalRecord` unchanged from the input result alongside `edges`/`pageInfo`.
- [ ] Unit test: extend `ListTransactionsUseCase.listTransactions`'s tests (`src/modules/transaction/__tests__/unit/use-cases/list-transactions-describe.test.ts`) asserting the resolved result's `totalRecord` is exactly what the mocked `TransactionRepository.findAllByUserId` returned.
- [ ] Bump `listTransactions`'s declared `complexity` from `10` to `12` on `TransactionResolver.listTransactions` (`src/modules/transaction/resolvers/transaction.resolver.ts`), per the GraphQL Blueprint's Complexity cost above.

### Phase 3: Polish

- [ ] E2E tests for `listTransactions` (`src/modules/transaction/__tests__/integration/e2e/list-transactions-describe.test.ts`, extend the `LIST_TRANSACTIONS` document to select `category { id title description icon color }` and `totalRecord`, extend the existing `describe` block): `category.description`/`category.icon` are returned for a transaction with a category; `category` still resolves `null` for a transaction without one; `totalRecord` equals the full filtered-match count while `edges` only holds the current page (create more transactions than `first`); `totalRecord` changes correctly as filters narrow the result set; `totalRecord` never includes another user's transactions.
- [ ] Run `pnpm dev` (or any command that builds the schema) to regenerate `schema.graphql`, then commit the diff (expected: `TransactionCategoryType` gains `description: String` and `icon: String!`; `TransactionConnection` gains `totalRecord: Int!`; the `complexity` bump is not visible in `schema.graphql`, since `complexity` isn't part of the printed SDL).
- [ ] Run `pnpm test` and `pnpm build` and confirm both pass clean.

## Test Cases

### Phase 1: Foundation

- [ ] `findCategoriesByIdsAdapter` maps `description` (string and `null`) and `icon` into `CategoryDTO[]`
- [ ] `TransactionRepository.findAllByUserId` — `totalRecord` equals the full filtered-match count, independent of `first`
- [ ] `TransactionRepository.findAllByUserId` — `totalRecord` respects `description`/`type`/`categoryIds`/date-range filters
- [ ] `TransactionRepository.findAllByUserId` — `totalRecord` is scoped to `userId` (no cross-user leak)

### Phase 2: Features

- [ ] `toTransactionCategoryType` maps `description` (including `null`) and `icon`
- [ ] `toTransactionConnection` maps `totalRecord` unchanged from the repository result
- [ ] `ListTransactionsUseCase.listTransactions` — resolved `totalRecord` matches the mocked repository's return value

### Phase 3: Polish

- [ ] `listTransactions` — `category.description`/`category.icon` returned for a transaction with a category
- [ ] `listTransactions` — `category` still resolves `null` for a transaction without one
- [ ] `listTransactions` — `totalRecord` equals the full filtered-match count while `edges` only holds the current page
- [ ] `listTransactions` — `totalRecord` changes correctly as filters narrow the result set
- [ ] `listTransactions` — `totalRecord` never includes another user's transactions

## Dependencies

- External packages: none new — `Prisma.transaction.count()` and `Promise.all` are already available.
- Internal: none — touches only the `transaction` module plus the `category` module's existing adapter (the one sanctioned cross-module import point already used by PM-015 and earlier features), no new ports/adapters/gateways.

## Risks & Mitigations

| Risk                                                                                     | Impact | Mitigation                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra `COUNT(*)` query doubles DB round-trips per `listTransactions` call                | Low    | Acceptable at this feature's expected per-user scale (documented in Performance & Scale above); complexity budget bumped to reflect the added cost             |
| `findMany`/`count()` run as two independent, non-transactional reads — small race window | Low    | Accepted tradeoff, same class already present elsewhere in this codebase (e.g. `countByCategoryIds`); not worth a DB transaction for a read-only list endpoint |
| Forgetting to regenerate `schema.graphql`                                                | Low    | Explicit Phase 3 task; `pnpm build`/`pnpm test:e2e` both build the schema and would surface a stale-file diff in review                                        |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] New unit tests (`findCategoriesByIdsAdapter`, `toTransactionCategoryType`, `toTransactionConnection`, `ListTransactionsUseCase.listTransactions`) passing
- [ ] New integration test (`TransactionRepository.findAllByUserId`'s `totalRecord`) passing
- [ ] New e2e tests for `listTransactions`'s `category` object and `totalRecord` passing
- [ ] `pnpm test` and `pnpm build` pass clean
- [ ] `schema.graphql` regenerated and committed with only the expected additive diff
