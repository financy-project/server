# Category in Transaction - PM-017 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 2: Features

- [x] B-006: Add `description` and `icon` fields to `TransactionCategoryType` (`src/modules/transaction/graphql/object-types/transaction-category.object-type.ts`): `@Field(() => String, { nullable: true }) description?: string | null` and `@Field() icon!: string`, appended after the existing `color` field.
- [x] B-007: Add `totalRecord` field to `TransactionConnection` (`src/modules/transaction/graphql/object-types/transaction-connection.object-type.ts`): `@Field(() => Int) totalRecord!: number`, adding `Int` to the existing `type-graphql` import.
- [x] B-008: Update `toTransactionCategoryType` (`src/modules/transaction/mappers/transaction.mapper.ts`) to also map `description` and `icon` from the `CategoryDTO` argument.
- [x] B-009: Update `toTransactionConnection` (`src/modules/transaction/mappers/transaction-connection.mapper.ts`) to set `connection.totalRecord = result.totalRecord`; extend its local `PaginatedTransactions` type with `totalRecord: number`.
- [x] B-010: Extend `ListTransactionsUseCase`'s `ListTransactionsResult` type (`src/modules/transaction/use-cases/list-transactions.use-case.ts`) to add `totalRecord: number`, per the Use-Case Blueprint (no body change needed).
- [x] B-011: Unit tests: extend `toTransactionCategoryType`'s test (`src/modules/transaction/__tests__/unit/mappers/transaction-mapper-describe.test.ts`) asserting `description` (including a `null` case) and `icon` are mapped; add `src/modules/transaction/__tests__/unit/mappers/transaction-connection-mapper-describe.test.ts` asserting `toTransactionConnection` maps `totalRecord` unchanged from the input result alongside `edges`/`pageInfo`.
- [x] B-012: Unit test: extend `ListTransactionsUseCase.listTransactions`'s tests (`src/modules/transaction/__tests__/unit/use-cases/list-transactions-describe.test.ts`) asserting the resolved result's `totalRecord` is exactly what the mocked `TransactionRepository.findAllByUserId` returned.
- [x] B-013: Bump `listTransactions`'s declared `complexity` from `10` to `12` on `TransactionResolver.listTransactions` (`src/modules/transaction/resolvers/transaction.resolver.ts`), per the GraphQL Blueprint's Complexity cost above.
