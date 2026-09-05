# Bashboard - PM-020 - Test Cases

Generated mechanically from `plan.md`'s `## Test Cases` — each entry copied
verbatim, prefixed with a `T-NNN` id. Every case traces to a Use-Case
orchestration step, the Repository Blueprint, or a GraphQL Blueprint
response case in `plan.md`.

## Phase 1: Foundation

- [ ] T-001: `TransactionRepository.summarizeForUser` returns one row per `(categoryId, type)` pair with correct `totalValue`/`count` within the given range
- [ ] T-002: `TransactionRepository.summarizeForUser` excludes transactions with `date` outside `[startDate, endDate]`
- [ ] T-003: `TransactionRepository.summarizeForUser` excludes another user's transactions
- [ ] T-004: `TransactionRepository.summarizeForUser` includes a `categoryId: null` row for uncategorized transactions in range
- [ ] T-005: `TransactionRepository.summarizeForUser` returns `[]` for a user with no transactions in range

## Phase 2: Features

- [ ] T-006: `GetDashboardUseCase.getDashboard` computes `movement.income`/`expense`/`totalBalance` correctly from mixed `INCOME`/`EXPENSE` summary rows
- [ ] T-007: `GetDashboardUseCase.getDashboard` returns `movement` all-zero when `summarizeForUser` returns `[]`
- [ ] T-008: `GetDashboardUseCase.getDashboard` nets `totalValue` per category (`INCOME` adds, `EXPENSE` subtracts) and sums `transactionCount` across both types for that category
- [ ] T-009: `GetDashboardUseCase.getDashboard` excludes the `categoryId: null` group from `balanceByCategory`
- [ ] T-010: `GetDashboardUseCase.getDashboard` omits categories with no rows this month (i.e., never invents a zero-value entry)
- [ ] T-011: `GetDashboardUseCase.getDashboard` returns `recentTransactions` from `TransactionRepository.findAllByUserId`'s `items` unmodified (capped at 5, ordered by the repository's existing `date desc, id desc`)
- [ ] T-012: `dashboard` query (e2e) happy path: authenticated user with current-month activity gets correct `movement`, 5 `recentTransactions` with resolved `category`, and correct `balanceByCategory`
- [ ] T-013: `dashboard` query (e2e) empty-month path: authenticated user with no transactions this month gets `movement: { income: 0, expense: 0, totalBalance: 0 }` and `balanceByCategory: []` (but `recentTransactions` may still be non-empty from a prior month)
- [ ] T-014: `dashboard` query (e2e) unauthenticated: `errors[0].extensions.code === 'UNAUTHENTICATED'`
