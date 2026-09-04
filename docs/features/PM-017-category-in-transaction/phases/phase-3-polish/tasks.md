# Category in Transaction - PM-017 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 3: Polish

- [x] B-014: E2E tests for `listTransactions` (`src/modules/transaction/__tests__/integration/e2e/list-transactions-describe.test.ts`, extend the `LIST_TRANSACTIONS` document to select `category { id title description icon color }` and `totalRecord`, extend the existing `describe` block): `category.description`/`category.icon` are returned for a transaction with a category; `category` still resolves `null` for a transaction without one; `totalRecord` equals the full filtered-match count while `edges` only holds the current page (create more transactions than `first`); `totalRecord` changes correctly as filters narrow the result set; `totalRecord` never includes another user's transactions.
- [ ] B-015: Run `pnpm dev` (or any command that builds the schema) to regenerate `schema.graphql`, then commit the diff (expected: `TransactionCategoryType` gains `description: String` and `icon: String!`; `TransactionConnection` gains `totalRecord: Int!`; the `complexity` bump is not visible in `schema.graphql`, since `complexity` isn't part of the printed SDL).
- [ ] B-016: Run `pnpm test` and `pnpm build` and confirm both pass clean.
