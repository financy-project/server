# Transações - PM-004 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [x] T-001: `Transaction.create()` generates an `id` and copies `userId`/`categoryId`/`type`/`description`/`date`/`value`
- [x] T-002: `Transaction.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [x] T-003: `CreateTransactionValidation`/`UpdateTransactionValidation` reject an invalid `type`, empty `description`, non-date `date`, non-positive/non-integer `value`, and a non-UUID `categoryId`
- [x] T-004: `TransactionIdValidation` rejects a non-UUID `id`
- [x] T-005: `ListTransactionsValidation` rejects a one-sided date range, `endDate < startDate`, and `first` outside `[1, 50]`
- [x] T-006: `encodeCursor`/`decodeCursor` round-trip a `{ date, id }` pair; `decodeCursor` rejects a malformed cursor
- [x] T-007: `getCurrentMonthRange` returns the correct start/end for the current month
- [x] T-008: `TransactionRepository.create` persists a transaction
- [x] T-009: `TransactionRepository.findById` returns the transaction or throws `TransactionNotFoundError`
- [x] T-010: `TransactionRepository.findAllByUserId` returns only the given user's transactions within the date range, correctly paginated (`hasNextPage`/`endCursor`)
- [x] T-011: `TransactionRepository.update`/`remove` throw `TransactionNotFoundError` for a missing id
- [x] T-012: `CategoryRepository.findManyByIds` returns only the matching categories

## Phase 2: Features

- [ ] T-013: `findCategoriesByIdsAdapter` maps `CategoryRepository.findManyByIds` results to `CategoryDTO[]`
- [ ] T-014: `findCategoriesByIds` gateway dedupes ids and short-circuits an empty array
- [ ] T-015: `CreateTransactionUseCase.createTransaction` happy path returns the created `Transaction`; foreign/nonexistent `categoryId` → `TransactionCategoryNotFoundError`
- [ ] T-016: `ListTransactionsUseCase.listTransactions` defaults to `getCurrentMonthRange()` when no dates given; passes explicit dates through otherwise
- [ ] T-017: `UpdateTransactionUseCase.updateTransaction` / `DeleteTransactionUseCase.deleteTransaction`: not found → `TransactionNotFoundError`; not owned → `TransactionNotFoundError`; owned → delegates to the repository; `updateTransaction` with a foreign `categoryId` → `TransactionCategoryNotFoundError`
- [ ] T-018: `toTransactionType`/`toTransactionCategoryType`/`toUpdateTransactionPatch` map every field correctly
- [ ] T-019: `categoriesById` loader batches and returns results in input-key order, `null` for missing ids
- [ ] T-020: `createTransaction` mutation (e2e): happy path; foreign `categoryId` → `NOT_FOUND`; invalid `value`/`type`/`date`/`description` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [ ] T-021: `listTransactions` query (e2e): returns only the caller's own transactions, respects date filters, defaults to the current month, paginates, resolves `category`
- [ ] T-022: `updateTransaction`/`deleteTransaction` mutations (e2e): happy path; another user's transaction → `NOT_FOUND`; nonexistent id → `NOT_FOUND`; foreign `categoryId` on update → `NOT_FOUND`
- [ ] T-023: Deleting a category unlinks (not deletes) its transactions — `category: null` on re-query, transaction still present in `listTransactions`
