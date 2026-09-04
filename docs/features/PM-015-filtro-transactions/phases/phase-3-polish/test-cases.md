# Filtro Transactions - PM-015 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

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
