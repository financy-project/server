# Filtro Transactions - PM-015 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 1: Foundation

- [x] B-001: Add `getMonthRange(year: number, month: number): { startDate: Date; endDate: Date }` to `src/shared/utils/date-range.ts` — `month` is 1-12 (human-indexed); `startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)`, `endDate = new Date(year, month, 0, 23, 59, 59, 999)` (last day of that month, via day-0-of-next-month).
- [x] B-002: Unit tests for `getMonthRange` (`src/shared/utils/__tests__/unit/date-range-describe.test.ts`, new `describe('getMonthRange()')` block): `getMonthRange(2026, 1)` → Jan 1 00:00:00.000–Jan 31 23:59:59.999; `getMonthRange(2024, 2)` → Feb 1–29 (leap year, 29-day February); `getMonthRange(2026, 4)` → Apr 1–30 (30-day month).
- [x] B-003: Extend `TransactionRepository.findAllByUserId`'s `filter` parameter (`src/modules/transaction/repository/transaction.repository.ts`) to `{ startDate: Date | null; endDate: Date | null; description: string | null; type: TransactionKind | null; categoryIds: string[] | null }`, adding the four conditional `where` branches (date range included) from the Repository Blueprint above.
- [x] B-004: Integration tests for the new `TransactionRepository.findAllByUserId` filters (`src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts`, new `describe` block, `useDatabase()`): filters by `description` (case-insensitive partial match, e.g. `"MERCADO"` matches `"Compra no mercado"`); filters by `type` (only matching `TransactionKind` returned); filters by `categoryIds` (matches transactions in any of the given categories, none from other categories); combines `description` + `type` + `categoryIds` + an explicit date range together; `categoryIds: []` behaves as "no filter" (same result as omitting it); `startDate`/`endDate` both `null` returns transactions across all dates (no date bound applied).
