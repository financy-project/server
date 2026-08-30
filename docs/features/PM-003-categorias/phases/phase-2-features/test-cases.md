# Categorias - PM-003 - Phase 2: Features - Test Cases

- [x] T-009: `requireCurrentUser` returns the authenticated user or throws `UnauthenticatedError`
- [x] T-010: `CreateCategoryUseCase.createCategory` happy path returns the created `Category`
- [x] T-011: `ListCategoriesUseCase.listCategories` returns the repository's result for the given `userId`
- [x] T-012: `UpdateCategoryUseCase.updateCategory` / `DeleteCategoryUseCase.deleteCategory`: not found → `CategoryNotFoundError`; not owned → `CategoryNotFoundError` (same as not found); owned → delegates to the repository
- [x] T-013: `toCategoryType` maps every exposed field, including a `null` `description`
- [x] T-014: `createCategory` mutation (e2e): happy path; duplicate `title` → `CONFLICT`; invalid `color` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [x] T-015: `listCategories` query (e2e): returns only the caller's own categories
- [x] T-016: `updateCategory`/`deleteCategory` mutations (e2e): happy path; another user's category → `NOT_FOUND`; nonexistent id → `NOT_FOUND`
