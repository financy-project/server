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

## Phase 2: Features

- [ ] T-010: `ListTransactionsValidation` — `month` without `year` throws (`BAD_USER_INPUT`, path `'year'`)
- [ ] T-011: `ListTransactionsValidation` — `year` without `month` throws (`BAD_USER_INPUT`, path `'month'`)
- [ ] T-012: `ListTransactionsValidation` — `month`+`year` combined with `startDate` throws
- [ ] T-013: `ListTransactionsValidation` — `month`+`year` combined with `endDate` throws
- [ ] T-014: `ListTransactionsValidation` — `month`+`year` alone passes
- [ ] T-015: `ListTransactionsValidation` — neither `month`/`year` nor `startDate`/`endDate` passes (existing behavior preserved)
- [ ] T-016: `ListTransactionsUseCase.listTransactions` — `month`+`year` resolves via `getMonthRange`
- [ ] T-017: `ListTransactionsUseCase.listTransactions` — `startDate`+`endDate` passed through unchanged
- [ ] T-018: `ListTransactionsUseCase.listTransactions` — neither provided → repository called with `{ startDate: null, endDate: null }` (no date bound)
- [ ] T-019: `ListTransactionsUseCase.listTransactions` — `description`/`type`/`categoryIds` forwarded unchanged to the repository

## Phase 3: Polish

- [ ] T-020: `listTransactions` — filters by `description` alone
- [ ] T-021: `listTransactions` — filters by `type` alone
- [ ] T-022: `listTransactions` — filters by `categoryIds` alone
- [ ] T-023: `listTransactions` — filters by `month`+`year` alone
- [ ] T-024: `listTransactions` — no filters at all returns transactions from every period, not just the current month
- [ ] T-025: `listTransactions` — combines all five filters in one call
- [ ] T-026: `listTransactions` — a `categoryIds` entry belonging to another user returns no rows for that id
- [ ] T-027: `listTransactions` — `month` without `year` → `extensions.code: 'BAD_USER_INPUT'`
- [ ] T-028: `listTransactions` — `month`+`year` combined with `startDate` → `extensions.code: 'BAD_USER_INPUT'`
