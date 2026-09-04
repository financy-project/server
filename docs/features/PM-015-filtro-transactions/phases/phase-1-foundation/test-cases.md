# Filtro Transactions - PM-015 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [ ] T-001: `getMonthRange(2026, 1)` returns Jan 1 00:00:00.000–Jan 31 23:59:59.999
- [ ] T-002: `getMonthRange(2024, 2)` returns Feb 1–29 (leap year)
- [ ] T-003: `getMonthRange(2026, 4)` returns Apr 1–30
- [ ] T-004: `TransactionRepository.findAllByUserId` filters by `description` (case-insensitive partial match)
- [ ] T-005: `TransactionRepository.findAllByUserId` filters by `type`
- [ ] T-006: `TransactionRepository.findAllByUserId` filters by `categoryIds`
- [ ] T-007: `TransactionRepository.findAllByUserId` combines `description` + `type` + `categoryIds` + an explicit date range
- [ ] T-008: `TransactionRepository.findAllByUserId` — empty `categoryIds` array behaves as "no filter"
- [ ] T-009: `TransactionRepository.findAllByUserId` — `startDate`/`endDate` both `null` returns transactions across all dates
