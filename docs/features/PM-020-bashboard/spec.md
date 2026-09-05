# Bashboard - PM-020

## Description

Adds a single dashboard query that summarizes the requesting user's
financial activity for the current calendar month: an income/expense/
balance summary, the 5 most recent transactions, and a per-category
breakdown of transaction count and total value. All field names are in
English (illustrative Portuguese names from the original request are
translated below).

## Users

Client applications (web/mobile) rendering the user's home/dashboard
screen — anyone who needs a month-at-a-glance financial summary without
issuing three separate queries.

## Acceptance Criteria

- [ ] A single GraphQL query (e.g. `dashboard`) returns three objects,
      scoped to the requesting user and to the current calendar month
      (server-side "now", not a client-supplied month/year)
- [ ] `movement` object:
  - [ ] `income` — sum of all `TransactionKind.INCOME` transaction values
        in the current month
  - [ ] `expense` — sum of all `TransactionKind.EXPENSE` transaction
        values in the current month
  - [ ] `totalBalance` — `income - expense`
  - [ ] All three are `0` (not `null`/error) when the user has no
        transactions this month
- [ ] `recentTransactions` — the user's 5 most recent transactions
      (across all time, not just the current month), ordered by the
      transaction's `date` field descending (not by `createdAt`/insertion
      order), with same-`date` transactions broken by `createdAt`
      descending as a stable tiebreaker, in the same shape as
      `TransactionType` from `listTransactions` (including the resolved
      `category`)
  - [ ] Returns fewer than 5 (or an empty array) when the user has fewer
        than 5 transactions total
- [ ] `balanceByCategory` — one entry per category that has at least one
      transaction in the current month:
  - [ ] `title` — the category's title
  - [ ] `color` — the category's color
  - [ ] `transactionCount` — number of transactions that category has in
        the current month
  - [ ] `totalValue` — net sum of that category's transaction values in
        the current month (`INCOME` adds, `EXPENSE` subtracts, same sign
        convention as `movement.totalBalance`)
  - [ ] Categories with zero transactions this month are omitted
  - [ ] Transactions with no category are excluded from this list (not
        grouped under a synthetic "uncategorized" entry)
- [ ] Everything above is scoped strictly to the requesting user — never
      reflects another user's transactions or categories

## User Stories

### Story 1

As a client application, I want the current month's income, expense, and
total balance, so that I can render the top-level summary on the
dashboard.

**Acceptance Criteria:**

- [ ] `movement.income`, `movement.expense`, `movement.totalBalance` are
      correct for the current month
- [ ] Values are `0` when there is no activity this month

### Story 2

As a client application, I want the user's 5 most recent transactions in
the same shape the transaction list already uses, so that I can reuse
existing rendering logic without a follow-up query.

**Acceptance Criteria:**

- [ ] `recentTransactions` matches `TransactionType`'s shape
      (`id`, `type`, `description`, `date`, `value`, `category`)
- [ ] Ordered by transaction `date` descending (not `createdAt`), capped
      at 5

### Story 3

As a client application, I want a per-category breakdown of this month's
activity, so that I can render a spending-by-category chart or list.

**Acceptance Criteria:**

- [ ] One entry per category with ≥1 transaction this month, with
      `title`, `color`, `transactionCount`, `totalValue`
- [ ] No entry for categories with zero transactions this month

## Technical Notes

- Reference entities: `Transaction` (`type: TransactionKind`,
  `value: number`, `date`, `categoryId`) and `Category` (`title`, `color`)
  — see `src/modules/transaction/entity/transaction.entity.ts` and
  `src/modules/category/entity/category.entity.ts`.
- `listTransactions` already supports `month`/`year` filters
  (`src/modules/transaction/graphql/args/list-transactions.args.ts`) —
  the dashboard's "current month" scoping reuses that same filtering
  approach (server-computed current month/year), not a new date-range
  mechanism.
- `recentTransactions` is deliberately **not** scoped to the current
  month — it's the 5 most recent transactions overall, which may span
  into a previous month for users with low activity in the current one.
- `Category` has no income/expense typing of its own — a category can
  mix both `TransactionKind`s. `totalValue` therefore nets the two
  (`INCOME` adds, `EXPENSE` subtracts) rather than being computed
  per-type; this mirrors the `movement.totalBalance` convention.
- This is a new read-only aggregate spanning the `transaction` and
  `category` modules. Per the module-isolation rule in
  `constitution.md`, it should live in its own new `dashboard` module
  that reads from `transaction`/`category` through their existing public
  barrel exports/gateways — never reaching into their internals.
- Category aggregation should reuse/extend the existing
  `count-transactions-by-category-ids` gateway/adapter
  (`src/modules/category/gateways/`, `src/modules/transaction/adapters/`)
  rather than introducing a parallel counting mechanism.

## Out of Scope

- No date-range or arbitrary month/year selection — current month only
  (server-computed).
- No pagination on `recentTransactions` (fixed at 5) or
  `balanceByCategory`.
- No changes to `listTransactions`, `listCategories`, or their existing
  filters/shapes.
- No caching/memoization strategy.
