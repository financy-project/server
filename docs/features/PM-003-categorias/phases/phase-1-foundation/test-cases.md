# Categorias - PM-003 - Phase 1: Foundation - Test Cases

- [x] T-001: `Category.create()` generates an `id` and copies `userId`/`title`/`description`/`icon`/`color`
- [x] T-002: `Category.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [x] T-003: `CreateCategoryValidation`/`UpdateCategoryValidation` reject empty `title`, `description` over 500 chars, empty `icon`, and `color` not matching `#RRGGBB`
- [x] T-004: `CategoryIdValidation` rejects a non-UUID `id`
- [x] T-005: `CategoryRepository.create` persists a category and throws `CategoryAlreadyExistsError` on a duplicate `(userId, title)`
- [x] T-006: `CategoryRepository.findById` returns the category or throws `CategoryNotFoundError`
- [x] T-007: `CategoryRepository.findAllByUserId` returns only the given user's categories
- [x] T-008: `CategoryRepository.update`/`remove` throw `CategoryNotFoundError` for a missing id, and `update` throws `CategoryAlreadyExistsError` on a title collision
