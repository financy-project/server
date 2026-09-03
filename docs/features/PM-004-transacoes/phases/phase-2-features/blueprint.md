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
    Pick<TransactionProps, 'categoryId' | 'type' | 'description' | 'date' | 'value'>
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

    | Condition                                                    | Outcome                                     |
    | ------------------------------------------------------------ | -------------------------------------------- |
    | `categoryId` doesn't exist                                   | `findCategoriesByIds` returns `[]` → throw `TransactionCategoryNotFoundError` |
    | `categoryId` exists but `category.userId !== input.userId`   | throw `TransactionCategoryNotFoundError` (same as not-found — never confirms another user's category exists) |
    | `categoryId` exists and belongs to `input.userId`            | proceeds to `Transaction.create` + `TransactionRepository.create` |

  - **Emitted Events:** none — see Domain Events Blueprint.

- **`ListTransactionsUseCase.listTransactions(input: { userId: string; startDate: Date | null; endDate: Date | null; first: number; after: string | null }): Promise<{ items: Transaction[]; hasNextPage: boolean; endCursor: string | null }>`** (`src/modules/transaction/use-cases/list-transactions.use-case.ts`)
  - Steps: 1. `{ startDate, endDate } = input.startDate && input.endDate ? { startDate: input.startDate, endDate: input.endDate } : getCurrentMonthRange()` (new shared `src/shared/utils/date-range.ts` helper — see Implementation Details) 2. `return TransactionRepository.findAllByUserId(input.userId, { startDate, endDate }, { first: input.first, after: input.after })`
  - Decision Table:

    | Condition                                  | Outcome                                                        |
    | ------------------------------------------- | --------------------------------------------------------------- |
    | Both `startDate` and `endDate` provided      | Use them as-is (inclusive range) — args validation (below) already rejects one-sided ranges |
    | Neither provided                             | Default to `getCurrentMonthRange()` — first day of the current month 00:00 through the last day 23:59:59, server clock (UTC) |

- **`UpdateTransactionUseCase.updateTransaction(input: { id: string; userId: string; patch: UpdateTransactionPatch }): Promise<Transaction>`** (`src/modules/transaction/use-cases/update-transaction.use-case.ts`)
  - Steps: 1. `transaction = await TransactionRepository.findById(id)` 2. if `!transaction.belongsTo(userId)` throw `TransactionNotFoundError(id)` 3. if `patch.categoryId !== undefined`: `[category] = await findCategoriesByIds([patch.categoryId])`; if `!category || category.userId !== userId` throw `TransactionCategoryNotFoundError` 4. `return await TransactionRepository.update(id, patch)`
  - Decision Table:

    | Condition                                                    | Outcome                                        |
    | ------------------------------------------------------------ | ------------------------------------------------ |
    | No row with `id` exists                                      | `TransactionRepository.findById` throws `TransactionNotFoundError` |
    | Row exists, `transaction.belongsTo(userId)` is `false`        | throws `TransactionNotFoundError` — same as not-found |
    | Row exists, owned, `patch.categoryId` provided but invalid/foreign | throws `TransactionCategoryNotFoundError`, before any write |
    | Row exists, owned, `patch.categoryId` omitted or valid+owned  | proceeds to `TransactionRepository.update`        |
    | Row deleted between step 1 and step 4 (race)                  | `TransactionRepository.update` catches `P2025`, throws `TransactionNotFoundError` |

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

  | Field         | GraphQL type            | Nullable | Resolved via                                   |
  | ------------- | ------------------------ | -------- | ------------------------------------------------ |
  | `id`          | `ID!`                    | No       | `@Field()` (mapper)                               |
  | `type`        | `TransactionKind!`       | No       | `@Field()` (mapper)                               |
  | `description` | `String!`                | No       | `@Field()` (mapper)                               |
  | `date`        | `Date!`                  | No       | `@Field()` (mapper) — type-graphql's built-in `Date` scalar |
  | `value`       | `Int!`                   | No       | `@Field()` (mapper)                               |
  | `category`    | `TransactionCategoryType`| Yes      | `@FieldResolver` on `TransactionResolver` (DataLoader) |

  The class also carries a plain (non-`@Field()`) `categoryId!: string | null` property, set by the mapper, so the `category` `@FieldResolver` has something to key the loader on without re-fetching the `Transaction` row. This mirrors how `@Root()` objects commonly carry resolver-only data alongside their public schema fields.

  `PageInfo` (`src/shared/graphql/object-types/page-info.object-type.ts`) — new shared primitive, first paginated field in the app, reusable by future connections:

  | Field         | GraphQL type | Nullable |
  | ------------- | ------------ | -------- |
  | `hasNextPage` | `Boolean!`   | No       |
  | `endCursor`   | `String`     | Yes      |

  `TransactionEdge` and `TransactionConnection` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`):

  | Type                  | Field      | GraphQL type            | Nullable |
  | --------------------- | ---------- | ------------------------ | -------- |
  | `TransactionEdge`     | `node`     | `TransactionType!`       | No       |
  | `TransactionEdge`     | `cursor`   | `String!`                | No       |
  | `TransactionConnection` | `edges`  | `[TransactionEdge!]!`    | No       |
  | `TransactionConnection` | `pageInfo` | `PageInfo!`             | No       |

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
