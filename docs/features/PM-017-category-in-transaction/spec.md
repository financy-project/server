# Category in Transaction - PM-017

## Description

`listTransactions` currently embeds only a partial category projection
(`id`, `title`, `color`) on each transaction, and gives no way to know how
many transactions match the current filter beyond the current page. This
feature (1) returns the full category object on each transaction list item
and (2) adds a total record count to the connection, so a client can
compute total pages or drive a full paginated export of the filtered
result set.

## Users

Client applications consuming `listTransactions` (web/mobile) — anyone
rendering the transaction list with its category details, or building a
paginated/exportable view that needs to know the total match count.

## Acceptance Criteria

- [ ] Each `TransactionType.category` in `listTransactions` (and anywhere
      else `category` is resolved) exposes the category's `description` and
      `icon`, alongside the existing `id`, `title`, `color`
- [ ] `TransactionConnection` (the `listTransactions` response) exposes a
      `totalRecord: Int!` field: the total number of transactions matching
      the request's filters (`description`/`type`/`categoryIds`/date or
      month+year range), independent of `first`/`after` pagination
- [ ] `totalRecord` is correct with no filters, with any single filter, and
      with filters combined
- [ ] `totalRecord` stays scoped to the requesting user — never reflects
      another user's transactions

## User Stories

### Story 1

As a client application, I want each transaction's category to include its
full details (description, icon), so that I can render the category
without a follow-up query.

**Acceptance Criteria:**

- [ ] `category.description` and `category.icon` are populated when the
      transaction has a category
- [ ] `category` still resolves to `null` when the transaction has no
      category (unchanged behavior)

### Story 2

As a client application, I want to know the total number of transactions
matching my current filter, so that I can paginate through (or export) the
full result set instead of just the current page.

**Acceptance Criteria:**

- [ ] `totalRecord` reflects the filtered total, not the page size
- [ ] `totalRecord` updates correctly as filters change

## Technical Notes

- `category` on `TransactionType` is resolved via a `@FieldResolver` +
  `DataLoader` from a module-local `CategoryDTO` (transaction module never
  imports the category module's own GraphQL type — see `constitution.md`'s
  module isolation rule). Widening the embedded object means widening that
  DTO, not depending on the category module's `CategoryType`.
- `totalRecord` needs a query that counts all matching rows, not just the
  current page — the mechanics of this belong in `plan.md`, not here.

## Out of Scope

- `transactionsQuantity` (the category module's own aggregate count of a
  category's transactions) is not added to the embedded transaction-side
  category object — different concern, already available via `listCategories`.
- No new filters, mutations, or changes to `listCategories`.
- No change to cursor-based pagination itself (`first`/`after`, `hasNextPage`,
  `endCursor`) — `totalRecord` is additive.
