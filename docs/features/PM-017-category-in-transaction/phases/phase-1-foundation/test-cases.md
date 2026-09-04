# Category in Transaction - PM-017 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [ ] T-001: `findCategoriesByIdsAdapter` maps `description` (string and `null`) and `icon` into `CategoryDTO[]`
- [ ] T-002: `TransactionRepository.findAllByUserId` — `totalRecord` equals the full filtered-match count, independent of `first`
- [ ] T-003: `TransactionRepository.findAllByUserId` — `totalRecord` respects `description`/`type`/`categoryIds`/date-range filters
- [ ] T-004: `TransactionRepository.findAllByUserId` — `totalRecord` is scoped to `userId` (no cross-user leak)
