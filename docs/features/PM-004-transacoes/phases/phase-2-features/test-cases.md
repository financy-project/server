# Transações - PM-004 - Phase 2: Features - Test Cases

- [x] T-013: `findCategoriesByIdsAdapter` maps `CategoryRepository.findManyByIds` results to `CategoryDTO[]`
- [x] T-014: `findCategoriesByIds` gateway dedupes ids and short-circuits an empty array
- [x] T-015: `CreateTransactionUseCase.createTransaction` happy path returns the created `Transaction`; foreign/nonexistent `categoryId` → `TransactionCategoryNotFoundError`
- [x] T-016: `ListTransactionsUseCase.listTransactions` defaults to `getCurrentMonthRange()` when no dates given; passes explicit dates through otherwise
- [x] T-017: `UpdateTransactionUseCase.updateTransaction` / `DeleteTransactionUseCase.deleteTransaction`: not found → `TransactionNotFoundError`; not owned → `TransactionNotFoundError`; owned → delegates to the repository; `updateTransaction` with a foreign `categoryId` → `TransactionCategoryNotFoundError`
- [ ] T-018: `toTransactionType`/`toTransactionCategoryType`/`toUpdateTransactionPatch` map every field correctly
- [ ] T-019: `categoriesById` loader batches and returns results in input-key order, `null` for missing ids
- [ ] T-020: `createTransaction` mutation (e2e): happy path; foreign `categoryId` → `NOT_FOUND`; invalid `value`/`type`/`date`/`description` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [ ] T-021: `listTransactions` query (e2e): returns only the caller's own transactions, respects date filters, defaults to the current month, paginates, resolves `category`
- [ ] T-022: `updateTransaction`/`deleteTransaction` mutations (e2e): happy path; another user's transaction → `NOT_FOUND`; nonexistent id → `NOT_FOUND`; foreign `categoryId` on update → `NOT_FOUND`
- [ ] T-023: Deleting a category unlinks (not deletes) its transactions — `category: null` on re-query, transaction still present in `listTransactions`
