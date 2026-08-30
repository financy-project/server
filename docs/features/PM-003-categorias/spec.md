# Categorias - PM-003

## Description

Authenticated users manage their own transaction categories — create, edit, delete, and list. Each category holds a title, description, icon, and color, and is scoped to the user who created it. Categories will later be referenced by transactions (a future feature) to classify them.

## Users

Authenticated end users of the Financy app (registered via PM-001, authenticated via PM-002).

## Acceptance Criteria

- [ ] An authenticated user can create a category with `titulo` (title), `descricao` (description), `icone` (icon), and `cor` (color)
- [ ] An authenticated user can list all categories they created — never another user's categories
- [ ] An authenticated user can edit their own category (title, description, icon, color)
- [ ] An authenticated user can delete their own category
- [ ] Attempting to edit/delete a category that doesn't belong to the requester is rejected
- [ ] Unauthenticated requests to any category query/mutation are rejected (`UNAUTHENTICATED`)
- [ ] `titulo` is required and non-empty
- [ ] `cor` must be a valid color value (format to be finalized in `/feature-plan`)

## Out of Scope

- Linking categories to transactions (deferred to the transaction feature)
- Default/system-provided categories (seed data)
- Category sharing between users
- Reordering or custom sort of categories
