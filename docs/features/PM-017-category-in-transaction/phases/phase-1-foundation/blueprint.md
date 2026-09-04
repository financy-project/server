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

