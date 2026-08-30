# Categorias - PM-003 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 1: Foundation

- [x] B-001: Add `Category` model to `prisma/schema.prisma`: `id String @id`, `userId String`, `title String`, `description String?`, `icon String`, `color String`, `user User @relation(fields: [userId], references: [id])`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@unique([userId, title])`, `@@map("categories")`; add `categories Category[]` back-relation field to the existing `User` model. Run `pnpm prisma:migrate:dev` to generate the migration and `pnpm prisma:generate`.
- [x] B-002: Implement `Category` entity (`src/modules/category/entity/category.entity.ts`): `CategoryProps`, `CreateCategoryProps`, `UpdateCategoryPatch` types; `create(props)`, `fromRepository(props)`, `belongsTo(userId)`.
- [x] B-003: Unit tests for `Category` entity (`src/modules/category/__tests__/unit/entity/category-create-describe.test.ts`): `create` sets a generated `id` and copies all fields; `create` defaults `description` to whatever was passed (including `null`); `belongsTo` returns `true`/`false` correctly.
- [x] B-004: Implement `CategoryNotFoundError` (`NOT_FOUND`, i18n key `errors.category_not_found`) and `CategoryAlreadyExistsError` (`CONFLICT`, i18n key `errors.category_already_exists`) in `src/modules/category/errors/category-errors.ts`.
- [x] B-005: Implement shared `UnauthenticatedError` (`UNAUTHENTICATED`, i18n key `errors.unauthenticated`) in `src/shared/errors/unauthenticated-error.ts`; export it from `src/shared/errors/index.ts`.
- [x] B-006: Add i18n keys (en + pt-br) to `src/services/i18n.service.ts`: `errors.category_not_found`, `errors.category_already_exists`, `errors.unauthenticated`, `validations.category_title_required`, `validations.category_description_max`, `validations.category_icon_required`, `validations.category_color_format`, `validations.category_id_invalid`.
- [x] B-007: Implement `CreateCategoryInput` and `UpdateCategoryInput` (`src/modules/category/graphql/input-types/{create,update}-category.input.ts`) and `CategoryIdArgs` (`src/modules/category/graphql/args/category-id.args.ts`) exactly per the GraphQL Blueprint field lists.
- [x] B-008: Implement validation wrappers `CreateCategoryValidation.validate`, `UpdateCategoryValidation.validate`, `CategoryIdValidation.validate` (`src/modules/category/validation/*.validation.ts`), each a thin `validateInput(...)` call.
- [x] B-009: Unit tests for all three validations (`src/modules/category/__tests__/unit/validation/*-validation-describe.test.ts`): valid input passes; each individual field violation (`title` empty/too long, `description` over 500 chars, `icon` empty, `color` not matching `#RRGGBB`, `id` not a UUID) throws `ValidationError` with the matching `path`.
- [x] B-010: Implement `CategoryRepository` (`src/modules/category/repository/category.repository.ts`): `create`, `findById`, `findAllByUserId`, `update`, `remove` exactly per the Repository Blueprint, including the `P2002`/`P2025` translation.
- [x] B-011: Integration tests for `CategoryRepository` (`src/modules/category/__tests__/integration/repository/category-repository-describe.test.ts`, using `useDatabase()`): `create` persists and returns the category; `create` throws `CategoryAlreadyExistsError` on a duplicate `(userId, title)`; `findById` returns the category / throws `CategoryNotFoundError` when missing; `findAllByUserId` returns only that user's categories, ordered by `createdAt`; `update` persists changes / throws `CategoryNotFoundError` for a missing id / throws `CategoryAlreadyExistsError` on a title collision; `remove` deletes the row / throws `CategoryNotFoundError` for a missing id.

## Phase 2: Features

- [x] B-012: Implement `requireCurrentUser(ctx: GraphQLContext): AuthenticatedUser` in `src/shared/utils/require-current-user.ts`; export from `src/shared/utils/index.ts`.
- [x] B-013: Unit tests for `requireCurrentUser` (`src/shared/utils/__tests__/unit/require-current-user-describe.test.ts`): returns `ctx.currentUser` when set; throws `UnauthenticatedError` when `ctx.currentUser` is `null`.
- [x] B-014: Implement `CreateCategoryUseCase.createCategory`, `ListCategoriesUseCase.listCategories`, `UpdateCategoryUseCase.updateCategory`, `DeleteCategoryUseCase.deleteCategory` (`src/modules/category/use-cases/*.use-case.ts`) exactly per the Use-Case Blueprint's steps.
- [x] B-015: Unit tests for all four use-cases (`src/modules/category/__tests__/unit/use-cases/*-describe.test.ts`, `CategoryRepository` mocked): `createCategory` happy path returns the created entity; `listCategories` returns whatever the repository returns for that `userId`; `updateCategory`/`deleteCategory` each cover every row of their Decision Table (not found, not owned → `CategoryNotFoundError`; owned → proceeds and calls the right repository method with the right args).
- [x] B-016: Implement `CategoryType` object type (`src/modules/category/graphql/object-types/category.object-type.ts`) and `toCategoryType` mapper (`src/modules/category/mappers/category.mapper.ts`) per the GraphQL Blueprint field list.
- [x] B-017: Unit tests for `toCategoryType` (`src/modules/category/__tests__/unit/mappers/category-mapper-describe.test.ts`): maps all five exposed fields, including `description: null`.
- [x] B-018: Implement `CategoryResolver` (`src/modules/category/resolvers/category.resolver.ts`) with `createCategory`, `listCategories`, `updateCategory`, `deleteCategory` exactly per the Resolver signatures — each starting with `requireCurrentUser(ctx)`, validating via the matching `*Validation.validate`, delegating to the matching use-case, mapping the result through `toCategoryType`.
- [x] B-019: Register `CategoryResolver` in `src/schema/build-schema.ts`'s `resolvers` array.
- [x] B-020: Create `src/modules/category/index.ts` barrel export: `Category` entity + its prop types, `CategoryRepository`, `CategoryNotFoundError`/`CategoryAlreadyExistsError`, `CategoryResolver` — no use-cases/validations/mappers exported, per `01-module-structure.md`.
- [x] B-021: Run `pnpm dev` (or `pnpm build`) once to regenerate `schema.graphql`; commit the updated file.
- [x] B-022: E2E tests (`src/modules/category/__tests__/integration/e2e/*-describe.test.ts`, real `executeOperation()` calls, `useDatabase()`): `createCategory` happy path + duplicate-`title` `CONFLICT` + invalid-`color` `BAD_USER_INPUT` + unauthenticated `UNAUTHENTICATED`; `listCategories` returns only the caller's categories (seed two users' categories, assert isolation); `updateCategory` happy path + editing another user's category → `NOT_FOUND` + editing a nonexistent id → `NOT_FOUND`; `deleteCategory` happy path + deleting another user's category → `NOT_FOUND`.

## Phase 3: Polish

- [ ] B-023: Security review: confirm no test or resolver path ever returns `extensions.code: 'FORBIDDEN'` for category ownership (must always be `NOT_FOUND`, per the Architectural Decisions above) and that no error message leaks another user's `title`/`description` value.
- [ ] B-024: Confirm `pnpm build`, `pnpm lint`, and the full `pnpm test` suite (unit + integration + e2e) pass.
- [ ] B-025: Update `docs/features/PM-003-categorias/spec.md` acceptance criteria checkboxes to `[x]` as each is verified against the running e2e suite.
