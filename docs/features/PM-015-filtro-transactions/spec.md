# Filtro Transactions - PM-015

## Description

Add filtering support to the transactions listing so users can narrow down results by description, type, category, and period (month/year), instead of only browsing the full unfiltered list.

## Users

- End users managing their personal transactions, who need to locate specific transactions or narrow down a long list.

## Acceptance Criteria

- [ ] As a user, I can filter transactions by a description search term (partial/case-insensitive match)
- [ ] As a user, I can filter transactions by type (entrada/income or saída/expense)
- [ ] As a user, I can filter transactions by one or more categories
- [ ] As a user, I can filter transactions by period (month and year)
- [ ] Filters can be combined (e.g., description + type + category + period applied together)
- [ ] When no filters are applied, the existing unfiltered listing behavior is preserved
- [ ] Filtering is exposed via the `listTransactions` GraphQL query (or equivalent) as optional input arguments

## Out of Scope

- Any client/UI changes (tracked separately in the client repo) — this feature covers the backend GraphQL API only
- Filtering by amount range (not requested for this feature)
- Saved/persisted filter presets
