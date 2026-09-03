# Category Transactions Quantity - PM-012 - Phase 1: Foundation - Test Cases

- [ ] T-001: `TransactionRepository.countByCategoryIds` returns the correct count per `categoryId` across multiple categories
- [ ] T-002: `TransactionRepository.countByCategoryIds` — a `categoryId` with zero transactions is absent from the returned map
- [ ] T-003: `TransactionRepository.countByCategoryIds` — empty input returns `{}`
- [ ] T-004: `countTransactionsByCategoryIdsAdapter` delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged
