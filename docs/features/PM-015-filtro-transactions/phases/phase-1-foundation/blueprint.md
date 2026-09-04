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
