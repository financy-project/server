# Filtro Transactions - PM-015 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 3: Polish

- [x] B-011: E2E tests for `listTransactions` filters (`src/modules/transaction/__tests__/integration/e2e/list-transactions-describe.test.ts`, extending the existing `describe` block, `useDatabase()`): filters by `description` alone; filters by `type` alone; filters by `categoryIds` alone; filters by `month`+`year` alone; combines `description`+`type`+`categoryIds`+`month`+`year` in one call; **no filters at all returns transactions from every period, not just the current month** (create a transaction dated outside the current month and assert it's included — this is the existing "current-month default" test, updated to assert the new no-bound behavior instead); a `categoryIds` entry belonging to another user returns no rows for that id (no cross-user leak); `month` without `year` → `errors[].extensions.code: 'BAD_USER_INPUT'`; `month`+`year` combined with `startDate` → `errors[].extensions.code: 'BAD_USER_INPUT'`.
- [x] B-012: Add six new i18n keys to `src/services/i18n.service.ts` (both `en` and `pt-BR` maps): `validations.transaction_period_incomplete`, `validations.transaction_period_conflicts_with_date_range`, `validations.transaction_month_invalid`, `validations.transaction_year_invalid`, `validations.transaction_description_filter_invalid`, `validations.transaction_category_ids_invalid`.
- [ ] B-013: Run `pnpm dev` (or any command that builds the schema) to regenerate `schema.graphql`, then commit the diff (expected: `listTransactions` on the `Query` type gains `categoryIds: [ID!]`, `description: String`, `month: Int`, `type: TransactionKind`, `year: Int` arguments).
- [ ] B-014: Run `pnpm test` and `pnpm build` and confirm both pass clean.
