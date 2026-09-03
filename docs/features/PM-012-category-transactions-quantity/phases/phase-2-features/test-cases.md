# Category Transactions Quantity - PM-012 - Phase 2: Features - Test Cases

- [ ] T-005: `countTransactionsByCategoryIds` gateway dedupes ids before calling the adapter
- [ ] T-006: `countTransactionsByCategoryIds` gateway — empty input short-circuits without calling the adapter
- [ ] T-007: `buildTransactionsQuantityByCategoryIdLoader` resolves the correct count per id
- [ ] T-008: `buildTransactionsQuantityByCategoryIdLoader` defaults to `0` for an id absent from the gateway's result map
- [ ] T-009: `buildTransactionsQuantityByCategoryIdLoader` preserves 1:1 input/output order
