# Categorias - PM-003 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [ ] T-001: `Category.create()` generates an `id` and copies `userId`/`title`/`description`/`icon`/`color`
- [ ] T-002: `Category.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [ ] T-003: `CreateCategoryValidation`/`UpdateCategoryValidation` reject empty `title`, `description` over 500 chars, empty `icon`, and `color` not matching `#RRGGBB`
- [ ] T-004: `CategoryIdValidation` rejects a non-UUID `id`
- [ ] T-005: `CategoryRepository.create` persists a category and throws `CategoryAlreadyExistsError` on a duplicate `(userId, title)`
- [ ] T-006: `CategoryRepository.findById` returns the category or throws `CategoryNotFoundError`
- [ ] T-007: `CategoryRepository.findAllByUserId` returns only the given user's categories
- [ ] T-008: `CategoryRepository.update`/`remove` throw `CategoryNotFoundError` for a missing id, and `update` throws `CategoryAlreadyExistsError` on a title collision

## Phase 2: Features

- [ ] T-009: `requireCurrentUser` returns the authenticated user or throws `UnauthenticatedError`
- [ ] T-010: `CreateCategoryUseCase.createCategory` happy path returns the created `Category`
- [ ] T-011: `ListCategoriesUseCase.listCategories` returns the repository's result for the given `userId`
- [ ] T-012: `UpdateCategoryUseCase.updateCategory` / `DeleteCategoryUseCase.deleteCategory`: not found → `CategoryNotFoundError`; not owned → `CategoryNotFoundError` (same as not found); owned → delegates to the repository
- [ ] T-013: `toCategoryType` maps every exposed field, including a `null` `description`
- [ ] T-014: `createCategory` mutation (e2e): happy path; duplicate `title` → `CONFLICT`; invalid `color` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [ ] T-015: `listCategories` query (e2e): returns only the caller's own categories
- [ ] T-016: `updateCategory`/`deleteCategory` mutations (e2e): happy path; another user's category → `NOT_FOUND`; nonexistent id → `NOT_FOUND`
