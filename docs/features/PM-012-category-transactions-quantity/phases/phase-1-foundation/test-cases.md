# Category Transactions Quantity - PM-012 - Phase 1: Foundation - Test Cases

- [x] T-001: `TransactionRepository.countByCategoryIds` returns the correct count per `categoryId` across multiple categories
- [x] T-002: `TransactionRepository.countByCategoryIds` — a `categoryId` with zero transactions is absent from the returned map
- [x] T-003: `TransactionRepository.countByCategoryIds` — empty input returns `{}`
- [x] T-004: `countTransactionsByCategoryIdsAdapter` delegates to `TransactionRepository.countByCategoryIds` and returns its result unchanged
