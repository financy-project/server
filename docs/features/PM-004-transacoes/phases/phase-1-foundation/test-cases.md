# Transações - PM-004 - Phase 1: Foundation - Test Cases

- [x] T-001: `Transaction.create()` generates an `id` and copies `userId`/`categoryId`/`type`/`description`/`date`/`value`
- [x] T-002: `Transaction.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [ ] T-003: `CreateTransactionValidation`/`UpdateTransactionValidation` reject an invalid `type`, empty `description`, non-date `date`, non-positive/non-integer `value`, and a non-UUID `categoryId`
- [ ] T-004: `TransactionIdValidation` rejects a non-UUID `id`
- [ ] T-005: `ListTransactionsValidation` rejects a one-sided date range, `endDate < startDate`, and `first` outside `[1, 50]`
- [x] T-006: `encodeCursor`/`decodeCursor` round-trip a `{ date, id }` pair; `decodeCursor` rejects a malformed cursor
- [x] T-007: `getCurrentMonthRange` returns the correct start/end for the current month
- [ ] T-008: `TransactionRepository.create` persists a transaction
- [ ] T-009: `TransactionRepository.findById` returns the transaction or throws `TransactionNotFoundError`
- [ ] T-010: `TransactionRepository.findAllByUserId` returns only the given user's transactions within the date range, correctly paginated (`hasNextPage`/`endCursor`)
- [ ] T-011: `TransactionRepository.update`/`remove` throw `TransactionNotFoundError` for a missing id
- [ ] T-012: `CategoryRepository.findManyByIds` returns only the matching categories
