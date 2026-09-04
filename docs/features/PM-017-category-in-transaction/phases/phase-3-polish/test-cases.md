# Category in Transaction - PM-017 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 3: Polish

- [ ] T-008: `listTransactions` — `category.description`/`category.icon` returned for a transaction with a category
- [ ] T-009: `listTransactions` — `category` still resolves `null` for a transaction without one
- [ ] T-010: `listTransactions` — `totalRecord` equals the full filtered-match count while `edges` only holds the current page
- [ ] T-011: `listTransactions` — `totalRecord` changes correctly as filters narrow the result set
- [ ] T-012: `listTransactions` — `totalRecord` never includes another user's transactions
