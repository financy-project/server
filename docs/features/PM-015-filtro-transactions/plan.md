# Filtro Transactions - PM-015 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Types & Enums Blueprint

**Omitted:** No new enum — the type filter reuses the existing
`TransactionKind` enum (`src/modules/transaction/enums/transaction-kind.enum.ts`,
`EXPENSE` / `INCOME`), already registered on the schema. No new named domain
type either: the extra filter fields are added directly to the existing
inline `ListTransactionsArgs` / `ListTransactionsInput` shapes (see GraphQL
and Use-Case Blueprints below), consistent with how `startDate`/`endDate`
are handled today.

### Entity Blueprint

**Omitted:** `Transaction` gains no new property, method, or business rule.
Filtering is a query-shape concern (which rows come back), not a change to
what a transaction _is_ or how it behaves.

### Errors & Error Families Blueprint

**Omitted:** A filter combination that matches nothing returns an empty
`TransactionConnection` (`edges: []`), not an error — this is standard list
behavior, not a domain-error scenario. Invalid filter _input_ (e.g. `month`
without `year`) is surfaced through the existing generic `ValidationError`
(`@/shared/errors`, already used by `ListTransactionsValidation` for the
`startDate`/`endDate` pairing check) — no new domain error class is needed,
same precedent as the existing date-range validation.

### Repository Blueprint

- **Repository Name:** `TransactionRepository` (`src/modules/transaction/repository/transaction.repository.ts`) — existing repository, `findAllByUserId` extended (no new method).
- **Methods:**
  - `findAllByUserId(userId, filter, pagination)` — `filter` parameter type extended from `{ startDate: Date; endDate: Date }` to:
    ```ts
    type ListTransactionsFilter = {
      startDate: Date | null
      endDate: Date | null
      description: string | null
      type: TransactionKind | null
      categoryIds: string[] | null
    }
    ```
    `startDate`/`endDate` become nullable (were required `Date`) — see the Use-Case Blueprint's updated Decision Table: "no period filter at all" is now a real, explicit case (return every transaction for the user, paginated), not just an internal implementation detail defaulted away before reaching the repository.
- **Data Mapping:** the Prisma `where` clause gains four conditional branches, each only added when the corresponding filter is non-null (mirrors the existing conditional `cursor` spread) — the date range itself is now conditional too:
  ```ts
  where: {
    userId,
    ...(filter.startDate && filter.endDate
      ? { date: { gte: filter.startDate, lte: filter.endDate } }
      : {}),
    ...(filter.description
      ? { description: { contains: filter.description, mode: Prisma.QueryMode.insensitive } }
      : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.categoryIds && filter.categoryIds.length > 0
      ? { categoryId: { in: filter.categoryIds } }
      : {}),
    ...(cursor ? { OR: [...] } : {}),
  }
  ```
  `description` uses Postgres case-insensitive `contains` (partial match) per the spec's "busca por descrição". `categoryIds: []` (empty array) is treated as "no filter", not "match nothing" — same semantics as the existing `countByCategoryIds` empty-array short-circuit elsewhere in this repository, kept consistent. `startDate`/`endDate` both `null` means no date bound at all — the `userId`-scoped `orderBy: [{ date: 'desc' }, { id: 'desc' }]` + cursor pagination is unaffected and still works correctly across the full, unbounded history.

### Use-Case Blueprint

- **Use-Case Name:** `ListTransactionsUseCase.listTransactions` (existing, `src/modules/transaction/use-cases/list-transactions.use-case.ts`).
- **Inputs/Outputs:** input type extended:
  ```ts
  type ListTransactionsInput = {
    userId: string
    startDate: Date | null
    endDate: Date | null
    month: number | null
    year: number | null
    description: string | null
    type: TransactionKind | null
    categoryIds: string[] | null
    first: number
    after: string | null
  }
  ```
  Output (`ListTransactionsResult`) unchanged. Returns entities only, as today.
- **Orchestration Steps:**
  1. Resolve `{ startDate, endDate }` per the Decision Table below.
  2. Call `TransactionRepository.findAllByUserId(input.userId, { startDate, endDate, description: input.description, type: input.type, categoryIds: input.categoryIds }, { first: input.first, after: input.after })`.
- **Decision Table (period resolution — validation, see Use-Case ↔ Validation split below, already guarantees `month`/`year` are never partially set and never combined with `startDate`/`endDate`, so exactly one row ever applies):**

  | Condition                                              | Outcome                                                                     |
  | ------------------------------------------------------ | --------------------------------------------------------------------------- |
  | `month != null && year != null`                        | `{ startDate, endDate } = getMonthRange(year, month)`                       |
  | `startDate != null && endDate != null` (no month/year) | `{ startDate, endDate }` used as-is (existing behavior)                     |
  | none of the above provided                             | `{ startDate: null, endDate: null }` — **no date filter, all transactions** |

  **Behavior change vs. today:** the current production default (no `startDate`/`endDate` → silently scoped to the current month via `getCurrentMonthRange()`) is being replaced. Omitting every filter now returns **all** of the user's transactions, paginated — not just the current month's. `getCurrentMonthRange()` is no longer called by this use-case; the utility itself is left in place in `src/shared/utils/date-range.ts` (still tested, available for future reuse) since nothing else in the codebase currently depends on removing it. See Backward Compatibility below — this is a deliberate, requested change to already-shipped behavior, not an oversight.

- **Emitted Events:** none — read-only query, no state change.

### GraphQL Blueprint

- **Object Type(s):** none new — reuses existing `TransactionConnection` / `TransactionEdge` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`).
- **Input Type / Args Type:** `ListTransactionsArgs` (`src/modules/transaction/graphql/args/list-transactions.args.ts`) gains five new fields:
  ```ts
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'validations.transaction_description_filter_invalid' })
  description?: string

  @Field(() => TransactionKind, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionKind, { message: 'validations.transaction_type_invalid' })
  type?: TransactionKind

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true, message: 'validations.transaction_category_ids_invalid' })
  categoryIds?: string[]

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'validations.transaction_month_invalid' })
  @Max(12, { message: 'validations.transaction_month_invalid' })
  month?: number

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2000, { message: 'validations.transaction_year_invalid' })
  @Max(2100, { message: 'validations.transaction_year_invalid' })
  year?: number
  ```
  (`ID`, `IsArray`, `IsUUID`, `MaxLength` need adding to the existing `type-graphql`/`class-validator` imports.) Cross-field checks (`month`/`year` pairing, `month`/`year` vs `startDate`/`endDate` conflict) stay in `ListTransactionsValidation`, not here — same split already used for the existing `startDate`/`endDate` pairing check.
- **Resolver Name & Operation:** `TransactionResolver.listTransactions` (`@Query(() => TransactionConnection, { complexity: 10 })`, `src/modules/transaction/resolvers/transaction.resolver.ts`) — same operation, signature unchanged (`@Args() args: ListTransactionsArgs`), body updated to read the five new validated fields and pass them into `ListTransactionsUseCase.listTransactions`, defaulting each to `null` when `undefined` (same pattern as the existing `startDate ?? null`).
- **Mapper:** `toTransactionConnection` (`src/modules/transaction/mappers/transaction-connection.mapper.ts`) — unchanged; it maps the use-case result shape, which is unaffected by filtering.
- **DataLoader needed? No.** No new relational field is introduced — this only narrows an existing root list query's `where` clause.
- **Complexity cost:** unchanged (`complexity: 10` on `listTransactions`, already declared) — filtering doesn't change the field's shape (still one paginated list per call), so the existing cost stands; stated explicitly per the DoR rather than left implicit.

### Domain Events Blueprint

**Omitted:** No use-case emits or consumes an event here — read-only query.

## Architectural Decisions

- **Scope & Requirements:** Add optional `description`, `type`, `categoryIds`, `month`, `year` arguments to the `listTransactions` query, combinable with each other and with the existing pagination (`first`/`after`). Success = each filter narrows results correctly alone and in combination; **omitting all filters now returns all of the user's transactions, paginated — this intentionally changes today's default (previously silently scoped to the current month)**, per explicit request during planning. Out of scope (per `spec.md`): any client/UI change, amount-range filtering, saved filter presets. `month`/`year` is new sugar for period filtering; `startDate`/`endDate` is kept, and the two remain mutually exclusive per request (see Use-Case Decision Table) to avoid ambiguous overlapping ranges — `startDate`/`endDate` behavior is untouched when used, only the _no-filter-at-all_ case changes.
- **Data & State:** No new persisted entity, no migration — `Transaction` rows are unchanged; this only adds `where` conditions to an existing read query.
- **User Experience:** Happy path — combining any subset of the five filters narrows the list as expected. Failure modes, all `extensions.code: 'BAD_USER_INPUT'` (same as the existing date-range checks, via `ValidationError`): `month` without `year` (or vice versa) → `validations.transaction_period_incomplete`; `month`/`year` combined with `startDate`/`endDate` → `validations.transaction_period_conflicts_with_date_range`; `month`/`year` out of range → `validations.transaction_month_invalid` / `validations.transaction_year_invalid`; malformed `categoryIds` entry → `validations.transaction_category_ids_invalid`. All optional/nullable — no breaking change to client ergonomics.
- **Testing & Validation:** Unit tests for `getMonthRange`, the two new `ListTransactionsValidation` checks, and `ListTransactionsUseCase.listTransactions`'s period-resolution branching (all mocked/pure). Integration tests for `TransactionRepository.findAllByUserId`'s new `where` branches against a real database. E2E tests asserting `listTransactions` filters against the real GraphQL schema, including the two new `BAD_USER_INPUT` sad paths. Security test case: a `categoryIds` filter containing another user's category id returns zero matching rows for those ids (query is still scoped by `userId` — no cross-user leak), covered by the existing `userId` scoping, no new code needed but worth an explicit e2e assertion.
- **Implementation Details:** Touches only the `transaction` module (`graphql/args`, `validation`, `use-cases`, `repository`, `resolvers`) plus one shared utility (`src/shared/utils/date-range.ts`). No new package dependencies — `class-validator`'s `@IsArray`/`@IsUUID(..., { each: true })` and Prisma's `mode: Prisma.QueryMode.insensitive` are both already available. No relational field added → no `DataLoader`. Not a new list/deeply-nested field → complexity unchanged, stated explicitly above. `schema.graphql` **does** need regenerating (new arguments on `listTransactions`).
- **Security Considerations:** No new auth surface — filtering rides on `listTransactions`' existing `requireCurrentUser(ctx)` check; every filter is applied on top of the existing `userId` scope in the repository `where` clause, so a filter can narrow but never widen visibility beyond the current user's own transactions. No timing-sensitive comparisons involved (this isn't an auth check). No new rate-limiting concern — same single query, same `complexity: 10` cost regardless of how many filters are combined.
- **Complex Workflows:** Not Applicable — a single read query with a richer `where` clause, no multi-step process.
- **Cross-Cutting Concerns:** No new logging, caching, or metrics — same as the existing `listTransactions` query, which has none of its own beyond whatever global request logging already exists.
- **Error Scenarios & Failure Modes:** Database-down affects this the same as every other query (unhandled, propagates as `INTERNAL_SERVER_ERROR` via the existing `formatError` plugin) — no special-casing. No race conditions: read-only, no write path. No retry/timeout strategy beyond what already exists globally.
- **Performance & Scale:** Same query shape as today (one `findMany`, `take: first + 1`), just a richer, now-conditional `where`. The no-filter case no longer bounds the scan by date at all — it relies entirely on cursor pagination (`take: first + 1` + the `date`/`id` cursor `OR`) to keep each individual request cheap; the `userId` scope (already the leading condition) keeps the row set per-user rather than table-wide. `description`'s `contains` (case-insensitive) cannot use a standard B-tree index efficiently on Postgres — acceptable at this feature's expected scale (a single user's own transactions, realistically hundreds to low thousands of rows), flagged here rather than silently assumed; a `pg_trgm` index would be the follow-up if this becomes a bottleneck, explicitly out of scope for this feature. `type` and `categoryId` are low-cardinality/already-indexed-adjacent (via the existing FK) filters, negligible cost. Pagination strategy unchanged (cursor-based, already in place).
- **Module Composition:** Single module (`transaction`) — no cross-module communication needed, no port/adapter/gateway involved. Consistent with the "1 module" case in the checklist.
- **Deployment & Operations:** No database migration. Rollback = revert the commit(s); purely additive, optional arguments — safe to roll back without data cleanup. No feature flag — small additive change to an existing query. No new monitoring beyond what already exists for `listTransactions`.
- **Backward Compatibility:** Schema-wise additive (five new _optional_ arguments, no field removed/renamed/re-typed) — but **behaviorally breaking for the zero-argument call specifically**: `schema.graphql`'s diff still shows only the five new arguments, yet any existing client calling `listTransactions` with no `startDate`/`endDate` today (relying on the implicit current-month scope) will start receiving its entire transaction history instead, paginated. This is a deliberate, explicitly requested change, not an oversight — flagged here per the checklist's "changing existing behavior in place" anti-pattern so it isn't missed in review. No client repo change is in scope for this feature (`spec.md`), so any client that depends on the old implicit scoping must be updated separately to pass `month`/`year` (or `startDate`/`endDate`) itself if it still wants a bounded default — call this out to the client team before merging.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `getMonthRange(year: number, month: number): { startDate: Date; endDate: Date }` to `src/shared/utils/date-range.ts` — `month` is 1-12 (human-indexed); `startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)`, `endDate = new Date(year, month, 0, 23, 59, 59, 999)` (last day of that month, via day-0-of-next-month).
- [ ] Unit tests for `getMonthRange` (`src/shared/utils/__tests__/unit/date-range-describe.test.ts`, new `describe('getMonthRange()')` block): `getMonthRange(2026, 1)` → Jan 1 00:00:00.000–Jan 31 23:59:59.999; `getMonthRange(2024, 2)` → Feb 1–29 (leap year, 29-day February); `getMonthRange(2026, 4)` → Apr 1–30 (30-day month).
- [ ] Extend `TransactionRepository.findAllByUserId`'s `filter` parameter (`src/modules/transaction/repository/transaction.repository.ts`) to `{ startDate: Date | null; endDate: Date | null; description: string | null; type: TransactionKind | null; categoryIds: string[] | null }`, adding the four conditional `where` branches (date range included) from the Repository Blueprint above.
- [ ] Integration tests for the new `TransactionRepository.findAllByUserId` filters (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, new `describe` block, `useDatabase()`): filters by `description` (case-insensitive partial match, e.g. `"MERCADO"` matches `"Compra no mercado"`); filters by `type` (only matching `TransactionKind` returned); filters by `categoryIds` (matches transactions in any of the given categories, none from other categories); combines `description` + `type` + `categoryIds` + an explicit date range together; `categoryIds: []` behaves as "no filter" (same result as omitting it); `startDate`/`endDate` both `null` returns transactions across all dates (no date bound applied).

### Phase 2: Features

- [ ] Add `description`, `type`, `categoryIds`, `month`, `year` fields to `ListTransactionsArgs` (`src/modules/transaction/graphql/args/list-transactions.args.ts`) exactly as specified in the GraphQL Blueprint above, adding `ID`, `IsArray`, `IsUUID`, `MaxLength` to the existing imports.
- [ ] Extend `ListTransactionsValidation.validate` (`src/modules/transaction/validation/list-transactions.validation.ts`) with two checks, alongside the existing `startDate`/`endDate` pairing check: (1) `month` present XOR `year` present → `throwFieldError(hasMonth ? 'year' : 'month', 'validations.transaction_period_incomplete')`; (2) `month`+`year` both present AND (`startDate` or `endDate` present) → `throwFieldError('month', 'validations.transaction_period_conflicts_with_date_range')`.
- [ ] Unit tests for the two new `ListTransactionsValidation` checks (`src/modules/transaction/__tests__/unit/validation/list-transactions-validation-describe.test.ts`): `month` without `year` throws with path `'year'`; `year` without `month` throws with path `'month'`; `month`+`year` combined with `startDate` throws; `month`+`year` combined with `endDate` throws; `month`+`year` alone (no date range) passes; neither `month`/`year` nor `startDate`/`endDate` still passes (existing behavior preserved).
- [ ] Extend `ListTransactionsUseCase.listTransactions`'s input type and body (`src/modules/transaction/use-cases/list-transactions.use-case.ts`) per the Use-Case Blueprint's `ListTransactionsInput` type and Decision Table, and forward `description`, `type`, `categoryIds` unchanged into the `TransactionRepository.findAllByUserId` call.
- [ ] Unit tests for `ListTransactionsUseCase.listTransactions` (`src/modules/transaction/__tests__/unit/use-cases/list-transactions-describe.test.ts`, repository mocked): `month`+`year` given → repository called with `getMonthRange(year, month)`'s exact `{ startDate, endDate }`; `startDate`+`endDate` given (no month/year) → passed through unchanged; neither given → repository called with `{ startDate: null, endDate: null }` (**updates/replaces the existing "falls back to `getCurrentMonthRange()`" test** — that assertion no longer holds); `description`/`type`/`categoryIds` are forwarded to the repository call unchanged, `null` when not provided.
- [ ] Update `TransactionResolver.listTransactions` (`src/modules/transaction/resolvers/transaction.resolver.ts`) to read `validated.description`, `validated.type`, `validated.categoryIds`, `validated.month`, `validated.year` (each `?? null`) and pass them into `ListTransactionsUseCase.listTransactions`, alongside the existing `startDate`/`endDate`/`first`/`after`.

### Phase 3: Polish

- [ ] Add six new i18n keys to `src/services/i18n.service.ts` (both `en` and `pt-BR` maps): `validations.transaction_period_incomplete`, `validations.transaction_period_conflicts_with_date_range`, `validations.transaction_month_invalid`, `validations.transaction_year_invalid`, `validations.transaction_description_filter_invalid`, `validations.transaction_category_ids_invalid`.
- [ ] E2E tests for `listTransactions` filters (`src/modules/transaction/__tests__/integration/e2e/list-transactions-describe.test.ts`, extending the existing `describe` block, `useDatabase()`): filters by `description` alone; filters by `type` alone; filters by `categoryIds` alone; filters by `month`+`year` alone; combines `description`+`type`+`categoryIds`+`month`+`year` in one call; **no filters at all returns transactions from every period, not just the current month** (create a transaction dated outside the current month and assert it's included — this is the existing "current-month default" test, updated to assert the new no-bound behavior instead); a `categoryIds` entry belonging to another user returns no rows for that id (no cross-user leak); `month` without `year` → `errors[].extensions.code: 'BAD_USER_INPUT'`; `month`+`year` combined with `startDate` → `errors[].extensions.code: 'BAD_USER_INPUT'`.
- [ ] Run `pnpm dev` (or any command that builds the schema) to regenerate `schema.graphql`, then commit the diff (expected: `listTransactions` on the `Query` type gains `categoryIds: [ID!]`, `description: String`, `month: Int`, `type: TransactionKind`, `year: Int` arguments).
- [ ] Run `pnpm test` and `pnpm build` and confirm both pass clean.

## Test Cases

### Phase 1: Foundation

- [ ] `getMonthRange(2026, 1)` returns Jan 1 00:00:00.000–Jan 31 23:59:59.999
- [ ] `getMonthRange(2024, 2)` returns Feb 1–29 (leap year)
- [ ] `getMonthRange(2026, 4)` returns Apr 1–30
- [ ] `TransactionRepository.findAllByUserId` filters by `description` (case-insensitive partial match)
- [ ] `TransactionRepository.findAllByUserId` filters by `type`
- [ ] `TransactionRepository.findAllByUserId` filters by `categoryIds`
- [ ] `TransactionRepository.findAllByUserId` combines `description` + `type` + `categoryIds` + an explicit date range
- [ ] `TransactionRepository.findAllByUserId` — empty `categoryIds` array behaves as "no filter"
- [ ] `TransactionRepository.findAllByUserId` — `startDate`/`endDate` both `null` returns transactions across all dates

### Phase 2: Features

- [ ] `ListTransactionsValidation` — `month` without `year` throws (`BAD_USER_INPUT`, path `'year'`)
- [ ] `ListTransactionsValidation` — `year` without `month` throws (`BAD_USER_INPUT`, path `'month'`)
- [ ] `ListTransactionsValidation` — `month`+`year` combined with `startDate` throws
- [ ] `ListTransactionsValidation` — `month`+`year` combined with `endDate` throws
- [ ] `ListTransactionsValidation` — `month`+`year` alone passes
- [ ] `ListTransactionsValidation` — neither `month`/`year` nor `startDate`/`endDate` passes (existing behavior preserved)
- [ ] `ListTransactionsUseCase.listTransactions` — `month`+`year` resolves via `getMonthRange`
- [ ] `ListTransactionsUseCase.listTransactions` — `startDate`+`endDate` passed through unchanged
- [ ] `ListTransactionsUseCase.listTransactions` — neither provided → repository called with `{ startDate: null, endDate: null }` (no date bound)
- [ ] `ListTransactionsUseCase.listTransactions` — `description`/`type`/`categoryIds` forwarded unchanged to the repository

### Phase 3: Polish

- [ ] `listTransactions` — filters by `description` alone
- [ ] `listTransactions` — filters by `type` alone
- [ ] `listTransactions` — filters by `categoryIds` alone
- [ ] `listTransactions` — filters by `month`+`year` alone
- [ ] `listTransactions` — no filters at all returns transactions from every period, not just the current month
- [ ] `listTransactions` — combines all five filters in one call
- [ ] `listTransactions` — a `categoryIds` entry belonging to another user returns no rows for that id
- [ ] `listTransactions` — `month` without `year` → `extensions.code: 'BAD_USER_INPUT'`
- [ ] `listTransactions` — `month`+`year` combined with `startDate` → `extensions.code: 'BAD_USER_INPUT'`

## Dependencies

- External packages: none new — `class-validator`'s `@IsArray`/`@IsUUID(..., { each: true })` and Prisma's `Prisma.QueryMode.insensitive` are already available in the project's existing dependencies.
- Internal: none — single-module change, no cross-module ports/adapters/gateways involved.

## Risks & Mitigations

| Risk                                                                                                                                           | Impact     | Mitigation                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing the implicit current-month default breaks any existing client that relies on it (unbounded result set where it expected "this month") | **Medium** | Deliberate, explicitly requested change — called out in Scope & Requirements and Backward Compatibility above; the client team should be notified before this ships, since it's a behavioral change with no corresponding schema signal (`gh issue comment` on the tracking issue serves as that notice for now) |
| `month`/`year` vs `startDate`/`endDate` mutual-exclusivity rule surprises API consumers                                                        | Low        | Clear `BAD_USER_INPUT` error with a dedicated i18n message on conflict, covered by unit + e2e tests; documented in this plan                                                                                                                                                                                     |
| Unindexed `description` `contains` search degrades at high row counts                                                                          | Low        | Flagged explicitly in Performance & Scale above as an accepted tradeoff at this feature's expected scale; `pg_trgm` index is a documented, explicitly out-of-scope follow-up                                                                                                                                     |
| Forgetting to regenerate `schema.graphql`                                                                                                      | Low        | Explicit Phase 3 task; `pnpm build`/`pnpm test:e2e` both build the schema and would surface a stale-file diff in review                                                                                                                                                                                          |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] New unit tests (`date-range`, `ListTransactionsValidation`, `ListTransactionsUseCase`) passing
- [ ] New integration test (`TransactionRepository.findAllByUserId` filters) passing
- [ ] New e2e tests for `listTransactions` filters (happy paths + two sad paths) passing
- [ ] `pnpm test` and `pnpm build` pass clean
- [ ] `schema.graphql` regenerated and committed with only the expected additive diff
