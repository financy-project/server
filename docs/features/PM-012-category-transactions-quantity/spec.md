# Category Transactions Quantity - PM-012

## Description

`listCategories` (`CategoryResolver.listCategories`, `src/modules/category/resolvers/category.resolver.ts`)
returns `[CategoryType]` (`src/modules/category/graphql/object-types/category.object-type.ts`)
with `id`, `title`, `description`, `icon`, `color` — no indication of how much
that category is actually used. The client currently has no way to show "12
transactions" next to a category, or to warn a user before they delete a
category that still has transactions pointing at it.

This feature adds a new `transactionsQuantity: Int!` field to `CategoryType`:
the count of `Transaction` rows (`prisma/schema.prisma`'s `Transaction` model)
whose `categoryId` equals that category's `id`. `Category` and `Transaction`
are separate modules (`category`/`transaction`), so — mirroring the existing
reverse relation already built for PM-004 (`Transaction.category`, resolved
via `FindCategoriesByIdsPort`/`findCategoriesByIdsAdapter`/
`buildCategoriesByIdLoader`, see `src/modules/transaction/ports`,
`src/modules/category/adapters`, `src/modules/transaction/loaders`) — this
needs its own port/adapter/gateway/`DataLoader` in the opposite direction:
`category` module defines the port, `transaction` module (where the data
lives) implements the adapter, and a new per-request `DataLoader` batches the
count query so a list of N categories costs one query, not N.

## Users

- **Financy client (browser SPA)** — needs `transactionsQuantity` on every
  item returned by `listCategories` to show usage counts in the categories
  list/management UI, and potentially to warn before deleting a
  still-in-use category.

## Acceptance Criteria

- [ ] `CategoryType` gains a new field: `transactionsQuantity: Int!` (never
      `null` — a category with zero transactions reports `0`, not `null`).
- [ ] `listCategories` returns the correct `transactionsQuantity` for every
      category, computed from `Transaction` rows where `categoryId` matches.
- [ ] A category with zero transactions returns `transactionsQuantity: 0`.
- [ ] Requesting `transactionsQuantity` for N categories in one
      `listCategories` query executes **one** additional query (via
      `DataLoader`), not N — no N+1 regression per
      [12. GraphQL Operational Concerns](../../architecture/12-graphql-operational-concerns.md).
- [ ] Counting is scoped correctly: only transactions actually pointing at
      that `categoryId` are counted (unaffected by which user "owns" the
      transaction beyond the fact that `Category`/`Transaction` are already
      both scoped to the requesting user via existing auth checks — no new
      cross-user leak is introduced).
- [ ] `schema.graphql` is regenerated and committed with the new field.

## Out of Scope

- Any change to `deleteCategory`'s behavior (e.g. blocking or warning when
  `transactionsQuantity > 0`) — today, deleting a category just detaches its
  transactions (`onDelete: SetNull` on `Transaction.categoryId`, per
  `prisma/schema.prisma`). Changing that behavior is a separate feature; this
  one only exposes the count for the client to decide what to do with.
- A breakdown by transaction type (`EXPENSE` vs `INCOME`) or by date range —
  just a total count.
- Any change to `Transaction`'s schema, resolvers, or its existing
  `Transaction.category` relation/loader — this feature only adds the
  reverse direction.
- Pagination/sorting of `listCategories` itself — unaffected, still returns
  a plain list.
