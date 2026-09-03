# Category Transactions Quantity - PM-012 - Phase 3: Polish - Tasks

- [ ] B-013: E2E test for `listCategories { transactionsQuantity }` (`src/modules/category/__tests__/integration/e2e/list-categories-describe.test.ts`, extending the existing `describe` block, using `useDatabase()`): a category with 3 transactions reports `transactionsQuantity: 3`; a category with 0 transactions reports `transactionsQuantity: 0`; two categories in the same `listCategories` response each report their own correct, independent count.
- [ ] B-014: Run `pnpm dev` (or any test that builds the schema) to regenerate `schema.graphql`, then commit the resulting diff (expected: only the new `transactionsQuantity: Int!` field added to `CategoryType`, plus the schema's `Int` scalar declaration if not already present).
- [ ] B-015: Run `pnpm test` and `pnpm build` and confirm both pass clean.
