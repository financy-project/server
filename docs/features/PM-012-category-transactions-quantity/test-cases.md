# Category Transactions Quantity - PM-012 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [x] T-001: `TransactionRepository.countByCategoryIds` returns the correct count per `categoryId` across multiple categories
- [x] T-002: `TransactionRepository.countByCategoryIds` — a `categoryId` with zero transactions is absent from the returned map
- [x] T-003: `TransactionRepository.countByCategoryIds` — empty input returns `{}`
- [x] T-004: `countTransactionsByCategoryIdsAdapter` delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged

## Phase 2: Features

- [ ] T-005: `countTransactionsByCategoryIds` gateway dedupes ids before calling the adapter
- [ ] T-006: `countTransactionsByCategoryIds` gateway — empty input short-circuits without calling the adapter
- [ ] T-007: `buildTransactionsQuantityByCategoryIdLoader` resolves the correct count per id
- [ ] T-008: `buildTransactionsQuantityByCategoryIdLoader` defaults to `0` for an id absent from the gateway's result map
- [ ] T-009: `buildTransactionsQuantityByCategoryIdLoader` preserves 1:1 input/output order

## Phase 3: Polish

- [ ] T-010: `listCategories` — a category with 3 transactions reports `transactionsQuantity: 3`
- [ ] T-011: `listCategories` — a category with 0 transactions reports `transactionsQuantity: 0`
- [ ] T-012: `listCategories` — two categories in the same response each report their own independent count
