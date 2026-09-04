# Category in Transaction - PM-017 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [ ] T-001: `findCategoriesByIdsAdapter` maps `description` (string and `null`) and `icon` into `CategoryDTO[]`
- [ ] T-002: `TransactionRepository.findAllByUserId` — `totalRecord` equals the full filtered-match count, independent of `first`
- [ ] T-003: `TransactionRepository.findAllByUserId` — `totalRecord` respects `description`/`type`/`categoryIds`/date-range filters
- [ ] T-004: `TransactionRepository.findAllByUserId` — `totalRecord` is scoped to `userId` (no cross-user leak)

## Phase 2: Features

- [ ] T-005: `toTransactionCategoryType` maps `description` (including `null`) and `icon`
- [ ] T-006: `toTransactionConnection` maps `totalRecord` unchanged from the repository result
- [ ] T-007: `ListTransactionsUseCase.listTransactions` — resolved `totalRecord` matches the mocked repository's return value

## Phase 3: Polish

- [ ] T-008: `listTransactions` — `category.description`/`category.icon` returned for a transaction with a category
- [ ] T-009: `listTransactions` — `category` still resolves `null` for a transaction without one
- [ ] T-010: `listTransactions` — `totalRecord` equals the full filtered-match count while `edges` only holds the current page
- [ ] T-011: `listTransactions` — `totalRecord` changes correctly as filters narrow the result set
- [ ] T-012: `listTransactions` — `totalRecord` never includes another user's transactions
