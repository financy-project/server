# Transações - PM-004 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Entity Blueprint

- **Entity Name:** `Transaction` (`src/modules/transaction/entity/transaction.entity.ts`)
- **Enum:** `TransactionKind` (`src/modules/transaction/enums/transaction-kind.enum.ts`) — `EXPENSE`, `INCOME` (SCREAMING_SNAKE_CASE, English keys; named `TransactionKind` rather than `TransactionType` to avoid colliding with the GraphQL object type `TransactionType`, per this repo's `<Entity>Type` convention)
- **Properties:**
  ```ts
  type TransactionProps = {
    id: string
    userId: string
    categoryId: string | null
    type: TransactionKind
    description: string
    date: Date
    value: number // integer, cents, always > 0
  }

  type CreateTransactionProps = Omit<TransactionProps, 'id' | 'categoryId'> & {
    categoryId: string // required at creation time, unlike TransactionProps.categoryId
  }

  type UpdateTransactionPatch = Partial<
    Pick<
      TransactionProps,
      'categoryId' | 'type' | 'description' | 'date' | 'value'
    >
  >
  ```
- **Methods:**
  - `static create(props: CreateTransactionProps): Transaction` — generates `id` via `generateUUID()`
  - `static fromRepository(props: TransactionProps): Transaction`
  - `belongsTo(userId: string): boolean` — `return this.userId === userId`, same ownership rule as `Category.belongsTo()`

### Repository Blueprint

- **Repository Name:** `TransactionRepository` (`src/modules/transaction/repository/transaction.repository.ts`)
- **Methods:**
  - `create(transaction: Transaction): Promise<Transaction>` — `prisma.transaction.create()`
  - `findById(id: string): Promise<Transaction>` — `prisma.transaction.findUnique({ where: { id } })`; throws `TransactionNotFoundError(id)` if not found. Does **not** check ownership — the use-case's job via `Transaction.belongsTo()`
  - `findAllByUserId(userId: string, filter: { startDate: Date; endDate: Date }, pagination: { first: number; after: string | null }): Promise<{ items: Transaction[]; hasNextPage: boolean; endCursor: string | null }>` — keyset pagination:
    ```ts
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: filter.startDate, lte: filter.endDate },
        ...(cursor ? { OR: [...keyset condition from decoded cursor...] } : {}),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: pagination.first + 1, // fetch one extra row to compute hasNextPage
    })
    ```
    Decodes `pagination.after` via the new shared `decodeCursor`/`encodeCursor` helpers (see Implementation Details); the keyset condition is `(date, id) < (cursor.date, cursor.id)` in `date DESC, id DESC` order, expressed as a Prisma `OR` of `{ date: { lt: cursor.date } }` and `{ date: cursor.date, id: { lt: cursor.id } }`. Slices the extra row off before returning, sets `hasNextPage` accordingly, and `endCursor` from the last returned row (`null` if the page is empty).
  - `update(id: string, patch: UpdateTransactionPatch): Promise<Transaction>` — `prisma.transaction.update({ where: { id }, data: patch })`; catches Prisma `P2025` (row deleted between the use-case's ownership check and this call) → rethrows `TransactionNotFoundError(id)`
  - `remove(id: string): Promise<void>` — `prisma.transaction.delete({ where: { id } })`; catches `P2025` → rethrows `TransactionNotFoundError(id)`
- **Data Mapping:** 1:1 for `userId`/`categoryId`/`type`/`description`/`value`; `date` is stored as Postgres `@db.Date` (no time component) and read back by Prisma as a JS `Date` at UTC midnight — `Transaction.fromRepository(row)` needs no conversion beyond passing the row through.

### Use-Case Blueprint

- **`CreateTransactionUseCase.createTransaction(input: CreateTransactionProps & { userId: string }): Promise<Transaction>`** (`src/modules/transaction/use-cases/create-transaction.use-case.ts`)
  - Steps: 1. `[category] = await findCategoriesByIds([input.categoryId])` (transaction module's gateway, see GraphQL/Module Composition below) 2. if `!category || category.userId !== input.userId` throw `TransactionCategoryNotFoundError` 3. `Transaction.create(input)` 4. `TransactionRepository.create(transaction)` 5. return the created `Transaction`
  - Decision Table:

    | Condition                                                  | Outcome                                                                                                      |
    | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
    | `categoryId` doesn't exist                                 | `findCategoriesByIds` returns `[]` → throw `TransactionCategoryNotFoundError`                                |
    | `categoryId` exists but `category.userId !== input.userId` | throw `TransactionCategoryNotFoundError` (same as not-found — never confirms another user's category exists) |
    | `categoryId` exists and belongs to `input.userId`          | proceeds to `Transaction.create` + `TransactionRepository.create`                                            |

  - **Emitted Events:** none — see Domain Events Blueprint.

- **`ListTransactionsUseCase.listTransactions(input: { userId: string; startDate: Date | null; endDate: Date | null; first: number; after: string | null }): Promise<{ items: Transaction[]; hasNextPage: boolean; endCursor: string | null }>`** (`src/modules/transaction/use-cases/list-transactions.use-case.ts`)
  - Steps: 1. `{ startDate, endDate } = input.startDate && input.endDate ? { startDate: input.startDate, endDate: input.endDate } : getCurrentMonthRange()` (new shared `src/shared/utils/date-range.ts` helper — see Implementation Details) 2. `return TransactionRepository.findAllByUserId(input.userId, { startDate, endDate }, { first: input.first, after: input.after })`
  - Decision Table:

    | Condition                               | Outcome                                                                                                                      |
    | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
    | Both `startDate` and `endDate` provided | Use them as-is (inclusive range) — args validation (below) already rejects one-sided ranges                                  |
    | Neither provided                        | Default to `getCurrentMonthRange()` — first day of the current month 00:00 through the last day 23:59:59, server clock (UTC) |

- **`UpdateTransactionUseCase.updateTransaction(input: { id: string; userId: string; patch: UpdateTransactionPatch }): Promise<Transaction>`** (`src/modules/transaction/use-cases/update-transaction.use-case.ts`)
  - Steps: 1. `transaction = await TransactionRepository.findById(id)` 2. if `!transaction.belongsTo(userId)` throw `TransactionNotFoundError(id)` 3. if `patch.categoryId !== undefined`: `[category] = await findCategoriesByIds([patch.categoryId])`; if `!category || category.userId !== userId` throw `TransactionCategoryNotFoundError` 4. `return await TransactionRepository.update(id, patch)`
  - Decision Table:

    | Condition                                                          | Outcome                                                                           |
    | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
    | No row with `id` exists                                            | `TransactionRepository.findById` throws `TransactionNotFoundError`                |
    | Row exists, `transaction.belongsTo(userId)` is `false`             | throws `TransactionNotFoundError` — same as not-found                             |
    | Row exists, owned, `patch.categoryId` provided but invalid/foreign | throws `TransactionCategoryNotFoundError`, before any write                       |
    | Row exists, owned, `patch.categoryId` omitted or valid+owned       | proceeds to `TransactionRepository.update`                                        |
    | Row deleted between step 1 and step 4 (race)                       | `TransactionRepository.update` catches `P2025`, throws `TransactionNotFoundError` |

- **`DeleteTransactionUseCase.deleteTransaction(input: { id: string; userId: string }): Promise<void>`** (`src/modules/transaction/use-cases/delete-transaction.use-case.ts`)
  - Steps: 1. `transaction = await TransactionRepository.findById(id)` 2. if `!transaction.belongsTo(userId)` throw `TransactionNotFoundError(id)` 3. `await TransactionRepository.remove(id)`
  - Decision Table: identical shape to `UpdateTransactionUseCase`'s first two + race rows (no `categoryId` row, delete has no conflicting field).

  **Emitted Events:** none for any use-case above — see Domain Events Blueprint.

### GraphQL Blueprint

- **Object Types:**

  `TransactionCategoryType` (`src/modules/transaction/graphql/object-types/transaction-category.object-type.ts`) — local to this module, deliberately **not** the category module's own `CategoryType` (module isolation: transaction must not import another module's GraphQL type):

  | Field   | GraphQL type | Nullable |
  | ------- | ------------ | -------- |
  | `id`    | `ID!`        | No       |
  | `title` | `String!`    | No       |
  | `color` | `String!`    | No       |

  `TransactionType` (`src/modules/transaction/graphql/object-types/transaction.object-type.ts`):

  | Field         | GraphQL type              | Nullable | Resolved via                                                |
  | ------------- | ------------------------- | -------- | ----------------------------------------------------------- |
  | `id`          | `ID!`                     | No       | `@Field()` (mapper)                                         |
  | `type`        | `TransactionKind!`        | No       | `@Field()` (mapper)                                         |
  | `description` | `String!`                 | No       | `@Field()` (mapper)                                         |
  | `date`        | `Date!`                   | No       | `@Field()` (mapper) — type-graphql's built-in `Date` scalar |
  | `value`       | `Int!`                    | No       | `@Field()` (mapper)                                         |
  | `category`    | `TransactionCategoryType` | Yes      | `@FieldResolver` on `TransactionResolver` (DataLoader)      |

  The class also carries a plain (non-`@Field()`) `categoryId!: string | null` property, set by the mapper, so the `category` `@FieldResolver` has something to key the loader on without re-fetching the `Transaction` row. This mirrors how `@Root()` objects commonly carry resolver-only data alongside their public schema fields.

  `PageInfo` (`src/shared/graphql/object-types/page-info.object-type.ts`) — new shared primitive, first paginated field in the app, reusable by future connections:

  | Field         | GraphQL type | Nullable |
  | ------------- | ------------ | -------- |
  | `hasNextPage` | `Boolean!`   | No       |
  | `endCursor`   | `String`     | Yes      |

  `TransactionEdge` and `TransactionConnection` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`):

  | Type                    | Field      | GraphQL type          | Nullable |
  | ----------------------- | ---------- | --------------------- | -------- |
  | `TransactionEdge`       | `node`     | `TransactionType!`    | No       |
  | `TransactionEdge`       | `cursor`   | `String!`             | No       |
  | `TransactionConnection` | `edges`    | `[TransactionEdge!]!` | No       |
  | `TransactionConnection` | `pageInfo` | `PageInfo!`           | No       |

- **Enum registration:** `registerEnumType(TransactionKind, { name: 'TransactionKind' })` — called once, alongside the entity/module setup (e.g. top of `transaction.object-type.ts` or a small `enums/index.ts` side-effect import registered from `build-schema.ts`'s module graph — first enum in the codebase, so pick whichever existing module bootstraps its side effects, if any; otherwise call it directly where `TransactionKind` is first imported by a GraphQL file).

- **Input Types:**
  - `CreateTransactionInput` (`.../graphql/input-types/create-transaction.input.ts`):
    - `type: TransactionKind` — `@Field(() => TransactionKind)` `@IsEnum(TransactionKind, { message: 'validations.transaction_type_invalid' })`
    - `description: string` — `@Field()` `@Length(1, 500, { message: 'validations.transaction_description_required' })`
    - `date: Date` — `@Field(() => Date)` `@IsDate({ message: 'validations.transaction_date_invalid' })`
    - `value: number` — `@Field(() => Int)` `@IsInt({ message: 'validations.transaction_value_integer' })` `@Min(1, { message: 'validations.transaction_value_positive' })`
    - `categoryId: string` — `@Field(() => ID)` `@IsUUID('all', { message: 'validations.transaction_category_id_invalid' })`
  - `UpdateTransactionInput` (`.../graphql/input-types/update-transaction.input.ts`): same five fields, all optional — same `ValidateIf((input) => input.<field> !== undefined)` pattern as `UpdateCategoryInput` (an explicitly-sent empty/invalid value still fails validation; only a fully-omitted field is allowed). No way to send an explicit `null` for `categoryId` — clearing a category only happens automatically via category deletion (`onDelete: SetNull`), never through this mutation, per the spec's Out of Scope.
  - **Args Type:** `TransactionIdArgs` (`.../graphql/args/transaction-id.args.ts`) — same shape as `CategoryIdArgs`: `id: string`, `@IsUUID('all', { message: 'validations.transaction_id_invalid' })`. Plain `validateInput()` DTO, not a bound `@ArgsType()` — mirrors `CategoryIdArgs` exactly.
  - **Args Type (bound):** `ListTransactionsArgs` (`.../graphql/args/list-transactions.args.ts`) — a real `@ArgsType()` (unlike `TransactionIdArgs`/`CategoryIdArgs`), since `listTransactions` has multiple independent optional parameters:
    - `startDate?: Date` — `@Field(() => Date, { nullable: true })` `@IsOptional()` `@IsDate({ message: 'validations.transaction_date_invalid' })`
    - `endDate?: Date` — same decorators, plus a class-level `@Validate` (or a manual check in the validation wrapper) rejecting `startDate`/`endDate` provided one without the other, and rejecting `endDate < startDate` — message keys `validations.transaction_date_range_incomplete` / `validations.transaction_date_range_invalid`
    - `first?: number` — `@Field(() => Int, { nullable: true, defaultValue: 20 })` `@IsOptional()` `@IsInt()` `@Min(1, { message: 'validations.transaction_first_min' })` `@Max(50, { message: 'validations.transaction_first_max' })`
    - `after?: string` — `@Field(() => String, { nullable: true })` `@IsOptional()` `@IsString()`

- **Resolver:** `TransactionResolver` (`src/modules/transaction/resolvers/transaction.resolver.ts`), declared as `@Resolver(() => TransactionType)` (not the bare `@Resolver()` `CategoryResolver` uses, since this resolver also hosts a `@FieldResolver`). All operations start with `const { id: userId } = requireCurrentUser(ctx)`:
  - `@Mutation(() => TransactionType) createTransaction(@Arg('input') input: CreateTransactionInput, @Ctx() ctx: GraphQLContext): Promise<TransactionType>`
  - `@Query(() => TransactionConnection, { complexity: 10 }) listTransactions(@Args() args: ListTransactionsArgs, @Ctx() ctx: GraphQLContext): Promise<TransactionConnection>`
  - `@Mutation(() => TransactionType) updateTransaction(@Arg('id', () => ID) id: string, @Arg('input') input: UpdateTransactionInput, @Ctx() ctx: GraphQLContext): Promise<TransactionType>`
  - `@Mutation(() => Boolean) deleteTransaction(@Arg('id', () => ID) id: string, @Ctx() ctx: GraphQLContext): Promise<boolean>`
  - `@FieldResolver(() => TransactionCategoryType, { nullable: true, complexity: 2 }) async category(@Root() transaction: TransactionType, @Ctx() ctx: GraphQLContext): Promise<TransactionCategoryType | null>` — `if (!transaction.categoryId) return null`; `const category = await ctx.loaders.categoriesById.load(transaction.categoryId)`; `return category ? toTransactionCategoryType(category) : null`

- **Mapper:** new `toTransactionType(transaction: Transaction): TransactionType` and `toTransactionCategoryType(category: CategoryDTO): TransactionCategoryType` (`src/modules/transaction/mappers/transaction.mapper.ts`); `toUpdateTransactionPatch(input: UpdateTransactionInput): UpdateTransactionPatch` (same `!== undefined` pattern as `toUpdateCategoryPatch`).

- **DataLoader needed?** **Yes.** `TransactionType.category` is a relational field resolved once per `Transaction` in a list — naive resolution is N+1 across a page of transactions. New loader `categoriesById` (`src/modules/transaction/loaders/categories-by-id.loader.ts`), built fresh per-request in `createContext` (`src/context/create-context.ts`, extending `GraphQLContext.loaders` beyond its current `Record<string, never>`), batching through the new cross-module gateway `findCategoriesByIds` (see Module Composition below), which ultimately calls the new `CategoryRepository.findManyByIds`.

- **Complexity cost:** `listTransactions` declares `complexity: 10` (a bounded, paginated list — page size capped at 50 via `ListTransactionsArgs.first`'s `@Max(50)`, so a static value is adequate; no dynamic per-item estimator needed, consistent with every other `complexity` declaration in this codebase so far). The `category` `@FieldResolver` declares `complexity: 2` (a relational hop, even though batched).

### Domain Events Blueprint

**Omitted:** no use-case above emits an event, and this feature doesn't subscribe to any existing event. A future reporting/balance feature may want to react to transaction create/update/delete — that's a decision for that feature's own plan.

---

## Architectural Decisions

- **Scope & Requirements:** Authenticated users create/list/edit/delete their own transactions (`type`, `description`, `date`, `value`, `categoryId`). `categoryId` is required at creation and must reference a category owned by the same user. Listing is paginated (cursor-based, max page size 50) and filterable by an inclusive `startDate`/`endDate`, defaulting to the current calendar month. Out of scope (per `spec.md`): recurring transactions, multi-currency, attachments, category/type filtering, aggregations/reports, split transactions, explicit category-clearing via mutation.
- **Data & State:** New `Transaction` table, one row per transaction, owned by exactly one `User` via `userId` (FK, default `Restrict` — deleting a user with transactions isn't a flow this feature handles, same posture as `Category`). `categoryId` is a **nullable** FK to `Category` with `onDelete: SetNull` — grill-me decision: deleting a category unlinks (doesn't cascade-delete or block) its transactions, so financial history is never silently destroyed by a category cleanup. `date` is stored `@db.Date` (no time component — grill-me decision). `value` is a plain `Int` representing cents (grill-me decision — avoids `Decimal`/float precision issues entirely; every boundary, client included, works in integer cents). Rows are hard-deleted by `deleteTransaction` — no soft-delete, matching `Category`'s precedent and the spec's plain "delete" requirement. New index `@@index([userId, date])` backs both the `listTransactions` filter and its `ORDER BY date DESC, id DESC` keyset pagination.
- **User Experience:** Every failure mode maps to a client-actionable `extensions.code`, extending `Category`'s precedent:
  - Not authenticated → `UNAUTHENTICATED` (existing shared `UnauthenticatedError`, reused as-is)
  - Malformed input (`value` not a positive integer, `type` not `EXPENSE`/`INCOME`, `description` empty, `date` not a date, `id`/`categoryId` not a UUID, `first` out of `[1, 50]`, one-sided or inverted date range) → `BAD_USER_INPUT` with field-level `validationErrors`
  - `categoryId` doesn't exist or belongs to another user (create or update) → `NOT_FOUND` (new `TransactionCategoryNotFoundError`) — grill-me decision, mirrors `Category`'s "never confirm another user's resource exists" posture
  - Editing/deleting another user's transaction, or a nonexistent one → `NOT_FOUND` (new `TransactionNotFoundError`, indistinguishable "not yours" vs "doesn't exist", same as `Category`)
  - A transaction whose category was since deleted returns `category: null` — not an error, not a broken transaction
- **Testing & Validation:** Unit tests for `Transaction` entity (`create`, `fromRepository`, `belongsTo`), all five use-cases (mocked `TransactionRepository` + mocked `findCategoriesByIds` gateway), both input validations, `TransactionIdArgs`/`ListTransactionsArgs` validation, both mappers, the `categoriesById` loader (mocked gateway, asserts batching + 1:1 key-to-result ordering), and the new `getCurrentMonthRange`/cursor helpers. Integration tests for `TransactionRepository` against the real database (`useDatabase()`), covering keyset pagination (multiple pages, `hasNextPage` correctness) and the date-range filter. Integration test for the new `CategoryRepository.findManyByIds`. E2E tests executing real GraphQL documents for all four operations plus the `category` field — happy path + each `extensions.code` above, the cross-user isolation case, the default-current-month behavior when no date range is given, and the "category deleted → `category: null`, transaction still listable" case (creates a category, a transaction against it, deletes the category via the existing `deleteCategory` mutation, re-queries the transaction).
- **Implementation Details:** Touches the new `transaction` module, plus small, additive changes to the already-shipped `category` module (`CategoryRepository.findManyByIds`, a new `category/adapters/` implementing the transaction module's port — see Module Composition), `prisma/schema.prisma` (new `Transaction` model + `TransactionKind` enum + `Category.transactions`/`User.transactions` back-relations), `src/context/create-context.ts` (first real entry in `GraphQLContext.loaders`, replacing its current `Record<string, never>`), and `src/schema/build-schema.ts` (register `TransactionResolver`). New shared, module-agnostic additions (justified as genuinely reusable, not premature): `src/shared/utils/cursor.ts` (`encodeCursor`/`decodeCursor` for the `{ date, id }` keyset pair — base64 of a small JSON payload), `src/shared/utils/date-range.ts` (`getCurrentMonthRange(): { startDate: Date; endDate: Date }`), `src/shared/graphql/object-types/page-info.object-type.ts` (`PageInfo`, the first Relay-style pagination primitive in the app — every future paginated list reuses it). No new npm dependencies — cursor pagination is hand-rolled with existing Prisma/base64, no `graphql-relay` or similar library pulled in for a single connection type. `schema.graphql` must be regenerated and committed as part of this PR. **Naming:** module, files, classes, entity/GraphQL/Prisma field names are all English (`transaction`, `type`, `description`, `date`, `value`, `categoryId`) — only translated user-facing strings are Portuguese/English per locale, consistent with `Category`.
- **Security Considerations:** Authentication via existing `ctx.currentUser` (unchanged). Authorization checked explicitly in every use-case that touches a specific row (`belongsTo`) or a cross-module reference (`category.userId === userId`) — never inferred from a non-null `ctx.currentUser` alone. `findCategoriesByIds` returning a category owned by a different user is treated identically to "category doesn't exist" (no enumeration signal). No new secrets. No timing concerns. Query complexity: `listTransactions` (`complexity: 10`) and `category` (`complexity: 2`) declared explicitly, on top of the server-wide complexity/depth limits already configured — a paginated, capped-at-50 list plus one relational hop per row can't be abused into an unbounded query.
- **Complex Workflows:** Not Applicable — every operation is a single atomic Prisma call, or two sequential calls for update/delete (read-then-write) / create (validate-category-then-write), same shape as `Category`'s.
- **Cross-Cutting Concerns:** No new logging beyond the existing `formatError` fallback. No caching. No new metrics beyond whatever error-rate-by-`extensions.code` monitoring already exists at the Apollo layer.
- **Error Scenarios & Failure Modes:** Database down → non-`DomainError` exception, masked as `INTERNAL_SERVER_ERROR` by the existing `formatError` fallback, no new handling needed. Race conditions: edit/delete racing a concurrent delete of the same transaction → `P2025` → `TransactionNotFoundError` (same pattern as `Category`); a category deleted concurrently with a transaction create/update referencing it → the `findCategoriesByIds` check (read) could pass moments before the `Category` row is deleted, then `Transaction.create`/`update` still succeeds (categoryId becomes valid-then-orphaned, immediately consistent with the "deleted category → `category: null`" behavior — no special-casing needed, this isn't actually a failure mode given `onDelete: SetNull`). No retries/timeouts beyond Prisma's own driver defaults.
- **Performance & Scale:** Transaction volume per user is expected to grow much faster than categories (grill-me decision drove cursor pagination, unlike `Category`'s unbounded `listCategories`). `@@index([userId, date])` backs the filtered, ordered query directly. Page size capped at 50 (`ListTransactionsArgs.first`'s `@Max(50)`).
- **Module Composition:** New `transaction` module. It needs synchronous, immediate-result data from `category` (validate a `categoryId` belongs to the requesting user; batch-fetch category summaries for the `category` field) — this is exactly the Ports & Adapters & Gateways case from `docs/architecture/10-cross-module-communication.md`, not an event:
  - **Port** (in `transaction`, the requester): `src/modules/transaction/ports/find-categories-by-ids.port.ts` — `type CategoryDTO = { id: string; userId: string; title: string; color: string }`, `type FindCategoriesByIdsPort = (ids: string[]) => Promise<CategoryDTO[]>`
  - **Adapter** (in `category`, the requested module): `src/modules/category/adapters/find-categories-by-ids.adapter.ts` — implements the port via the new `CategoryRepository.findManyByIds(ids)`, mapping each `Category` to a `CategoryDTO`; exported from a new `src/modules/category/adapters/index.ts` (adapters are their own import subpath, per the pattern's example — not re-exported through `category`'s main `index.ts` barrel, which stays limited to entity/repository/errors/resolver)
  - **Gateway** (in `transaction`): `src/modules/transaction/gateways/find-categories-by-ids.gateway.ts` — `findCategoriesByIds(ids: string[]): Promise<CategoryDTO[]>`, deduplicates `ids`, short-circuits to `[]` for an empty array, otherwise calls the adapter. Called by `CreateTransactionUseCase`, `UpdateTransactionUseCase`, and the `categoriesById` DataLoader — never by a resolver or adapter directly.
  - `transaction` does not import from `user`/`auth` directly — the only cross-module data it needs from them is `ctx.currentUser.id`, already provided by the request context (same as `Category`).
- **Deployment & Operations:** One new Prisma migration (`pnpm prisma:migrate:dev`) adding the `transactions` table, the `TransactionKind` enum, and the `Category.transactions`/`User.transactions` back-relations; rollback is the standard `prisma migrate` down-migration. No feature flag — net-new, additive operations with no interaction with existing clients.
- **Backward Compatibility:** Not Applicable — purely additive (new types, new queries/mutations, new nullable back-relations). No existing field, type, or argument is changed or removed. `Category`'s `deleteCategory` behavior is unchanged from the client's point of view (still succeeds, still returns `true`) — only its side effect gains a new consequence (`SetNull` on any referencing transactions) that this feature owns.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `TransactionKind` enum and `Transaction` model to `prisma/schema.prisma`: `enum TransactionKind { EXPENSE INCOME }`; `id String @id`, `userId String`, `categoryId String?`, `type TransactionKind`, `description String`, `date DateTime @db.Date`, `value Int`, `user User @relation(fields: [userId], references: [id])`, `category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@index([userId, date])`, `@@map("transactions")`; add `transactions Transaction[]` back-relation to both `User` and `Category` models. Run `pnpm prisma:migrate:dev` and `pnpm prisma:generate`.
- [ ] Implement `Transaction` entity (`src/modules/transaction/entity/transaction.entity.ts`): `TransactionProps`, `CreateTransactionProps`, `UpdateTransactionPatch` types; `create(props)`, `fromRepository(props)`, `belongsTo(userId)`.
- [ ] Unit tests for `Transaction` entity (`src/modules/transaction/__tests__/unit/entity/transaction-create-describe.test.ts`): `create` sets a generated `id` and copies all fields; `belongsTo` returns `true`/`false` correctly.
- [ ] Implement `TransactionNotFoundError` (`NOT_FOUND`, i18n key `errors.transaction_not_found`) and `TransactionCategoryNotFoundError` (`NOT_FOUND`, i18n key `errors.transaction_category_not_found`) in `src/modules/transaction/errors/transaction-errors.ts`.
- [ ] Add i18n keys (en + pt-br) to `src/services/i18n.service.ts`: `errors.transaction_not_found`, `errors.transaction_category_not_found`, `validations.transaction_type_invalid`, `validations.transaction_description_required`, `validations.transaction_date_invalid`, `validations.transaction_value_integer`, `validations.transaction_value_positive`, `validations.transaction_category_id_invalid`, `validations.transaction_id_invalid`, `validations.transaction_date_range_incomplete`, `validations.transaction_date_range_invalid`, `validations.transaction_first_min`, `validations.transaction_first_max`.
- [ ] Implement shared `encodeCursor`/`decodeCursor` (`src/shared/utils/cursor.ts`) for a `{ date: Date; id: string }` keyset pair (base64 of a small JSON payload); export from `src/shared/utils/index.ts`.
- [ ] Unit tests for `encodeCursor`/`decodeCursor` (`src/shared/utils/__tests__/unit/cursor-describe.test.ts`): round-trips `{ date, id }`; `decodeCursor` throws/returns a clear error on a malformed cursor string.
- [ ] Implement shared `getCurrentMonthRange(): { startDate: Date; endDate: Date }` (`src/shared/utils/date-range.ts`); export from `src/shared/utils/index.ts`.
- [ ] Unit tests for `getCurrentMonthRange` (`src/shared/utils/__tests__/unit/date-range-describe.test.ts`): returns the first day of the current month at start-of-day through the last day at end-of-day, using a mocked/fixed system clock.
- [ ] Implement `CreateTransactionInput`, `UpdateTransactionInput` (`src/modules/transaction/graphql/input-types/{create,update}-transaction.input.ts`), `TransactionIdArgs` (`src/modules/transaction/graphql/args/transaction-id.args.ts`), and `ListTransactionsArgs` (`src/modules/transaction/graphql/args/list-transactions.args.ts`) exactly per the GraphQL Blueprint field lists above.
- [ ] Implement validation wrappers `CreateTransactionValidation.validate`, `UpdateTransactionValidation.validate`, `TransactionIdValidation.validate`, `ListTransactionsValidation.validate` (`src/modules/transaction/validation/*.validation.ts`), each a thin `validateInput(...)` call.
- [ ] Unit tests for all four validations (`src/modules/transaction/__tests__/unit/validation/*-validation-describe.test.ts`): valid input passes; each individual field violation (`type` not in enum, `description` empty, `date` not a date, `value` non-integer/zero/negative, `categoryId`/`id` not a UUID, `first` outside `[1, 50]`, `startDate`/`endDate` one-sided or inverted) throws `ValidationError` with the matching `path`.
- [ ] Implement `TransactionRepository` (`src/modules/transaction/repository/transaction.repository.ts`): `create`, `findById`, `findAllByUserId` (keyset pagination), `update`, `remove` exactly per the Repository Blueprint.
- [ ] Integration tests for `TransactionRepository` (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, using `useDatabase()`): `create` persists and returns the transaction; `findById` returns the transaction / throws `TransactionNotFoundError` when missing; `findAllByUserId` returns only that user's transactions within the date range, ordered `date DESC, id DESC`, correct `hasNextPage`/`endCursor` across multiple pages; `update` persists changes / throws `TransactionNotFoundError` for a missing id; `remove` deletes the row / throws `TransactionNotFoundError` for a missing id.
- [ ] Add `CategoryRepository.findManyByIds(ids: string[]): Promise<Category[]>` to `src/modules/category/repository/category.repository.ts` — `prisma.category.findMany({ where: { id: { in: ids } } })`.
- [ ] Integration test for `CategoryRepository.findManyByIds` (`src/modules/category/__tests__/integration/repository/category-repository-describe.test.ts`, new `describe` block): returns only the matching rows, in any order, empty array for an empty/no-match input.

### Phase 2: Features

- [ ] Implement port `FindCategoriesByIdsPort`/`CategoryDTO` (`src/modules/transaction/ports/find-categories-by-ids.port.ts`); export from `src/modules/transaction/ports/index.ts`.
- [ ] Implement adapter `findCategoriesByIdsAdapter` (`src/modules/category/adapters/find-categories-by-ids.adapter.ts`), implementing `FindCategoriesByIdsPort` via `CategoryRepository.findManyByIds`, mapping each `Category` to `{ id, userId, title, color }`; export from new `src/modules/category/adapters/index.ts`.
- [ ] Unit test for the adapter (`src/modules/category/__tests__/unit/adapters/find-categories-by-ids-adapter-describe.test.ts`, `CategoryRepository` mocked): maps repository results to `CategoryDTO[]` correctly.
- [ ] Implement gateway `findCategoriesByIds` (`src/modules/transaction/gateways/find-categories-by-ids.gateway.ts`): dedupes `ids`, returns `[]` for an empty array without calling the adapter, otherwise calls `findCategoriesByIdsAdapter`; export from `src/modules/transaction/gateways/index.ts`.
- [ ] Unit tests for the gateway (`src/modules/transaction/__tests__/unit/gateways/find-categories-by-ids-gateway-describe.test.ts`, adapter mocked): dedupes ids before calling the adapter; empty input short-circuits without calling the adapter.
- [ ] Implement `CreateTransactionUseCase.createTransaction`, `ListTransactionsUseCase.listTransactions`, `UpdateTransactionUseCase.updateTransaction`, `DeleteTransactionUseCase.deleteTransaction` (`src/modules/transaction/use-cases/*.use-case.ts`) exactly per the Use-Case Blueprint's steps, calling the gateway (never the adapter directly).
- [ ] Unit tests for all four use-cases (`src/modules/transaction/__tests__/unit/use-cases/*-describe.test.ts`, `TransactionRepository` and the gateway mocked): each Decision Table row above, including `createTransaction`/`updateTransaction` rejecting a foreign/nonexistent `categoryId` with `TransactionCategoryNotFoundError`; `listTransactions` defaults to `getCurrentMonthRange()` when no dates are given and passes explicit dates through unchanged when given.
- [ ] Implement `TransactionCategoryType`, `TransactionType`, `PageInfo` (new `src/shared/graphql/object-types/page-info.object-type.ts`), `TransactionEdge`, `TransactionConnection` object types and `toTransactionType`/`toTransactionCategoryType`/`toUpdateTransactionPatch` mappers (`src/modules/transaction/mappers/transaction.mapper.ts`) per the GraphQL Blueprint field lists; register `TransactionKind` via `registerEnumType`.
- [ ] Unit tests for the mappers (`src/modules/transaction/__tests__/unit/mappers/transaction-mapper-describe.test.ts`): `toTransactionType` maps all five exposed fields plus the internal `categoryId`; `toTransactionCategoryType` maps `id`/`title`/`color`; `toUpdateTransactionPatch` only includes explicitly-provided fields.
- [ ] Implement `categoriesById` `DataLoader` (`src/modules/transaction/loaders/categories-by-id.loader.ts`) batching through the `findCategoriesByIds` gateway, returning `CategoryDTO | null` per requested id in input order; wire it into `src/context/create-context.ts`'s `GraphQLContext.loaders` (replacing the current `Record<string, never>` with `{ categoriesById: DataLoader<string, CategoryDTO | null> }`), built fresh per request.
- [ ] Unit tests for the loader (`src/modules/transaction/__tests__/unit/loaders/categories-by-id-loader-describe.test.ts`, gateway mocked): batches multiple `.load()` calls into a single gateway call; returns results in input-key order; returns `null` for an id the gateway didn't return.
- [ ] Implement `TransactionResolver` (`src/modules/transaction/resolvers/transaction.resolver.ts`) with `createTransaction`, `listTransactions`, `updateTransaction`, `deleteTransaction`, and the `category` `@FieldResolver` exactly per the Resolver signatures above — each mutation/query starting with `requireCurrentUser(ctx)`, validating via the matching `*Validation.validate`, delegating to the matching use-case, mapping the result through the mappers.
- [ ] Register `TransactionResolver` in `src/schema/build-schema.ts`'s `resolvers` array.
- [ ] Create `src/modules/transaction/index.ts` barrel export: `Transaction` entity + its prop types, `TransactionKind` enum, `TransactionRepository`, `TransactionNotFoundError`/`TransactionCategoryNotFoundError`, `TransactionResolver` — no use-cases/validations/mappers/ports/gateways exported, per `01-module-structure.md`.
- [ ] Run `pnpm dev` (or `pnpm build`) once to regenerate `schema.graphql`; commit the updated file.
- [ ] E2E tests (`src/modules/transaction/__tests__/integration/e2e/*-describe.test.ts`, real `executeOperation()` calls, `useDatabase()`): `createTransaction` happy path + foreign/nonexistent `categoryId` → `NOT_FOUND` + invalid `value`/`type`/`date`/`description` → `BAD_USER_INPUT` + unauthenticated → `UNAUTHENTICATED`; `listTransactions` returns only the caller's transactions within the requested range, defaults to the current month with no range given, paginates correctly across `first`/`after`, and resolves `category { id title color }` for a linked category; `updateTransaction`/`deleteTransaction` happy path + another user's transaction → `NOT_FOUND` + nonexistent id → `NOT_FOUND`; `updateTransaction` with a foreign `categoryId` → `NOT_FOUND`; the "category deleted → transaction's `category` is `null`, transaction still listable" flow (create category, create transaction against it, `deleteCategory`, re-query the transaction).

### Phase 3: Polish

- [ ] Security review: confirm no test or resolver path ever returns `extensions.code: 'FORBIDDEN'` for transaction/category ownership (must always be `NOT_FOUND`), and that no error message leaks another user's transaction/category data.
- [ ] Confirm `pnpm build`, `pnpm lint`, and the full `pnpm test` suite (unit + integration + e2e) pass.
- [ ] Update `docs/features/PM-004-transacoes/spec.md` acceptance criteria checkboxes to `[x]` as each is verified against the running e2e suite.

## Test Cases

### Phase 1: Foundation

- [ ] `Transaction.create()` generates an `id` and copies `userId`/`categoryId`/`type`/`description`/`date`/`value`
- [ ] `Transaction.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [ ] `CreateTransactionValidation`/`UpdateTransactionValidation` reject an invalid `type`, empty `description`, non-date `date`, non-positive/non-integer `value`, and a non-UUID `categoryId`
- [ ] `TransactionIdValidation` rejects a non-UUID `id`
- [ ] `ListTransactionsValidation` rejects a one-sided date range, `endDate < startDate`, and `first` outside `[1, 50]`
- [ ] `encodeCursor`/`decodeCursor` round-trip a `{ date, id }` pair; `decodeCursor` rejects a malformed cursor
- [ ] `getCurrentMonthRange` returns the correct start/end for the current month
- [ ] `TransactionRepository.create` persists a transaction
- [ ] `TransactionRepository.findById` returns the transaction or throws `TransactionNotFoundError`
- [ ] `TransactionRepository.findAllByUserId` returns only the given user's transactions within the date range, correctly paginated (`hasNextPage`/`endCursor`)
- [ ] `TransactionRepository.update`/`remove` throw `TransactionNotFoundError` for a missing id
- [ ] `CategoryRepository.findManyByIds` returns only the matching categories

### Phase 2: Features

- [ ] `findCategoriesByIdsAdapter` maps `CategoryRepository.findManyByIds` results to `CategoryDTO[]`
- [ ] `findCategoriesByIds` gateway dedupes ids and short-circuits an empty array
- [ ] `CreateTransactionUseCase.createTransaction` happy path returns the created `Transaction`; foreign/nonexistent `categoryId` → `TransactionCategoryNotFoundError`
- [ ] `ListTransactionsUseCase.listTransactions` defaults to `getCurrentMonthRange()` when no dates given; passes explicit dates through otherwise
- [ ] `UpdateTransactionUseCase.updateTransaction` / `DeleteTransactionUseCase.deleteTransaction`: not found → `TransactionNotFoundError`; not owned → `TransactionNotFoundError`; owned → delegates to the repository; `updateTransaction` with a foreign `categoryId` → `TransactionCategoryNotFoundError`
- [ ] `toTransactionType`/`toTransactionCategoryType`/`toUpdateTransactionPatch` map every field correctly
- [ ] `categoriesById` loader batches and returns results in input-key order, `null` for missing ids
- [ ] `createTransaction` mutation (e2e): happy path; foreign `categoryId` → `NOT_FOUND`; invalid `value`/`type`/`date`/`description` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [ ] `listTransactions` query (e2e): returns only the caller's own transactions, respects date filters, defaults to the current month, paginates, resolves `category`
- [ ] `updateTransaction`/`deleteTransaction` mutations (e2e): happy path; another user's transaction → `NOT_FOUND`; nonexistent id → `NOT_FOUND`; foreign `categoryId` on update → `NOT_FOUND`
- [ ] Deleting a category unlinks (not deletes) its transactions — `category: null` on re-query, transaction still present in `listTransactions`

## Dependencies

- No new external packages — cursor pagination is hand-rolled (base64 + JSON), no `graphql-relay`/pagination library added.
- Internal: extends `prisma/schema.prisma`, `src/context/create-context.ts` (first real `loaders` entry), `src/schema/build-schema.ts`; adds `src/shared/utils/cursor.ts`, `src/shared/utils/date-range.ts`, `src/shared/graphql/object-types/page-info.object-type.ts` for reuse by future paginated features; extends the already-shipped `category` module with `CategoryRepository.findManyByIds` and a new `adapters/` directory.

## Risks & Mitigations

| Risk                                                                              | Impact | Mitigation                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled keyset pagination cursor logic has an off-by-one or ordering bug      | Medium | Dedicated integration tests assert `hasNextPage`/`endCursor` across multiple pages against a real database, not just unit-level mocks                     |
| Forgetting to regenerate `schema.graphql`                                         | Medium | Explicit Phase 2 task; PR review should diff `schema.graphql` alongside the resolver changes, same as `Category`'s precedent                              |
| `onDelete: SetNull` behavior not covered by a test, silently regresses later      | Medium | Explicit e2e test: create category → create transaction → delete category → re-query transaction, asserting `category: null` and the transaction persists |
| `NOT_FOUND`-for-everything (transaction and category) masks genuine bugs manually | Low    | Server-side logs still show the real Prisma/entity state; only the client-facing message is unified, same posture as `Category`                           |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] Tests passing (unit + integration + e2e)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` committed, reflecting the four new transaction operations and the `category` field
