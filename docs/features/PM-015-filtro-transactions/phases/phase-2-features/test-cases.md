# Filtro Transactions - PM-015 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

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
