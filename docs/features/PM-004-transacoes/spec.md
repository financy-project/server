# Transações - PM-004

## Description

Authenticated users manage their own financial transactions — create, edit, delete, and list. Each transaction holds a `value` (in cents), a `type` (`EXPENSE` or `INCOME`), a `date` (day only, no time), a `description`, and a required reference to one of the user's own categories (PM-003). Transactions are scoped to the user who created them. Listing is paginated and filterable by date range, defaulting to the current month.

## Users

Authenticated end users of the Financy app (registered via PM-001, authenticated via PM-002).

## Acceptance Criteria

- [x] An authenticated user can create a transaction with `type` (`EXPENSE` or `INCOME`), `description`, `date`, `value` (positive integer, cents), and `categoryId` (required, must reference a category owned by the requester)
- [x] An authenticated user can list their own transactions, paginated (cursor-based) and filterable by `startDate`/`endDate` — defaulting to the current month when no range is given — never another user's transactions
- [x] An authenticated user can edit their own transaction (`type`, `description`, `date`, `value`, `categoryId`)
- [x] An authenticated user can delete their own transaction
- [x] Attempting to edit/delete a transaction that doesn't belong to the requester is rejected (`NOT_FOUND`)
- [x] Unauthenticated requests to any transaction query/mutation are rejected (`UNAUTHENTICATED`)
- [x] `value` is required and must be a positive integer (cents)
- [x] `type` is required and must be one of `EXPENSE`, `INCOME`
- [x] `description` is required and non-empty
- [x] `date` is required
- [x] `categoryId` must reference a category owned by the requesting user, both on create and on update (otherwise rejected with `NOT_FOUND`)
- [x] If the category referenced by a transaction is later deleted, the transaction's category becomes empty (not deleted itself) — a transaction never disappears because its category did
- [x] Each transaction exposes a summary of its linked category (name + color) so clients can render it without a second query

## Out of Scope

- Recurring/scheduled transactions
- Multi-currency support
- Attachments/receipts
- Filtering by category or type (only date-range filtering is in scope; category/type filters deferred to a future feature)
- Aggregations/reports (totals, balances, charts)
- Splitting a transaction across multiple categories
- Explicitly clearing a transaction's category via update (only automatic, via category deletion)
