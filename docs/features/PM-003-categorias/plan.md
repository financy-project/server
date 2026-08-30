# Categorias - PM-003 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Entity Blueprint

- **Entity Name:** `Category` (`src/modules/category/entity/category.entity.ts`)
- **Properties:**
  ```ts
  type CategoryProps = {
    id: string
    userId: string
    titulo: string
    descricao: string | null
    icone: string
    cor: string
  }

  type CreateCategoryProps = Omit<CategoryProps, 'id'>

  type UpdateCategoryPatch = Partial<
    Pick<CategoryProps, 'titulo' | 'descricao' | 'icone' | 'cor'>
  >
  ```
- **Methods:**
  - `static create(props: CreateCategoryProps): Category` — generates `id` via `generateUUID()`
  - `static fromRepository(props: CategoryProps): Category`
  - `belongsTo(userId: string): boolean` — `return this.userId === userId`; the single ownership rule every use-case below relies on to decide `NOT_FOUND` vs proceed

### Repository Blueprint

- **Repository Name:** `CategoryRepository` (`src/modules/category/repository/category.repository.ts`)
- **Methods:**
  - `create(category: Category): Promise<Category>` — `prisma.category.create()`; catches `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'` (violates the `@@unique([userId, titulo])` constraint) and rethrows `CategoryAlreadyExistsError`
  - `findById(id: string): Promise<Category>` — `prisma.category.findUnique({ where: { id } })`; throws `CategoryNotFoundError(id)` if not found (same convention as `UserRepository.findById`). Does **not** check ownership — that's the use-case's job via `Category.belongsTo()`
  - `findAllByUserId(userId: string): Promise<Category[]>` — `prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })`
  - `update(id: string, patch: UpdateCategoryPatch): Promise<Category>` — `prisma.category.update({ where: { id }, data: patch })`; catches `P2025` (row deleted between the use-case's ownership check and this call) → rethrows `CategoryNotFoundError(id)`; catches `P2002` → rethrows `CategoryAlreadyExistsError`
  - `remove(id: string): Promise<void>` — `prisma.category.delete({ where: { id } })`; catches `P2025` → rethrows `CategoryNotFoundError(id)`
- **Data Mapping:** 1:1 — the Prisma model's columns are named identically to the entity's props (`titulo`, `descricao`, `icone`, `cor`), so `Category.fromRepository(row)` needs no field renaming. This is a deliberate choice (see Implementation Details below) to avoid a translation layer with zero benefit.

### Use-Case Blueprint

- **`CreateCategoryUseCase.createCategory(input: CreateCategoryProps): Promise<Category>`** (`src/modules/category/use-cases/create-category.use-case.ts`)
  - Steps: 1. `Category.create(input)` 2. `CategoryRepository.create(category)` (repository translates `P2002` → `CategoryAlreadyExistsError`) 3. return the created `Category`
  - Decision Table: not required — single linear path; the only failure mode (duplicate `titulo` for the same user) is translated by the repository, not branched on here.

- **`ListCategoriesUseCase.listCategories(userId: string): Promise<Category[]>`** (`src/modules/category/use-cases/list-categories.use-case.ts`)
  - Steps: 1. return `CategoryRepository.findAllByUserId(userId)`
  - Decision Table: not required — no branching.

- **`UpdateCategoryUseCase.updateCategory(input: { id: string; userId: string; patch: UpdateCategoryPatch }): Promise<Category>`** (`src/modules/category/use-cases/update-category.use-case.ts`)
  - Steps: 1. `category = await CategoryRepository.findById(id)` 2. if `!category.belongsTo(userId)` throw `CategoryNotFoundError(id)` 3. `return await CategoryRepository.update(id, patch)`
  - Decision Table:

    | Condition                                                     | Outcome                                                                                                                                                      |
    | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | No row with `id` exists                                       | `CategoryRepository.findById` throws `CategoryNotFoundError`                                                                                                 |
    | Row exists, `category.belongsTo(userId)` is `false`           | Use-case throws `CategoryNotFoundError` — **same error/message** as the row-missing case, so a client can never distinguish "not yours" from "doesn't exist" |
    | Row exists, `category.belongsTo(userId)` is `true`            | Proceeds to `CategoryRepository.update`                                                                                                                      |
    | Row deleted between step 1 and step 3 (race)                  | `CategoryRepository.update` catches Prisma `P2025`, throws `CategoryNotFoundError`                                                                           |
    | `patch.titulo` collides with another of the user's categories | `CategoryRepository.update` catches `P2002`, throws `CategoryAlreadyExistsError`                                                                             |

- **`DeleteCategoryUseCase.deleteCategory(input: { id: string; userId: string }): Promise<void>`** (`src/modules/category/use-cases/delete-category.use-case.ts`)
  - Steps: 1. `category = await CategoryRepository.findById(id)` 2. if `!category.belongsTo(userId)` throw `CategoryNotFoundError(id)` 3. `await CategoryRepository.remove(id)`
  - Decision Table: identical shape to `UpdateCategoryUseCase`'s first three rows (no `titulo` collision row, since delete has no conflicting field), plus the same race-condition row ending in `CategoryRepository.remove` catching `P2025` → `CategoryNotFoundError`.

  **Emitted Events:** none — see Domain Events Blueprint.

### GraphQL Blueprint

- **Object Type:** `CategoryType` (`src/modules/category/graphql/object-types/category.object-type.ts`)

  | Field       | GraphQL type | Nullable |
  | ----------- | ------------ | -------- |
  | `id`        | `ID!`        | No       |
  | `titulo`    | `String!`    | No       |
  | `descricao` | `String`     | Yes      |
  | `icone`     | `String!`    | No       |
  | `cor`       | `String!`    | No       |

  (`userId` is intentionally **not** exposed — ownership is implicit via `ctx.currentUser`, never a client-supplied or client-visible field.)

- **Input Types:**
  - `CreateCategoryInput` (`.../graphql/input-types/create-category.input.ts`):
    - `titulo: string` — `@Field()` `@Length(1, 100, { message: 'validations.category_titulo_required' })`
    - `descricao?: string` — `@Field({ nullable: true })` `@IsOptional()` `@MaxLength(500, { message: 'validations.category_descricao_max' })`
    - `icone: string` — `@Field()` `@Length(1, 100, { message: 'validations.category_icone_required' })`
    - `cor: string` — `@Field()` `@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'validations.category_cor_format' })`
  - `UpdateCategoryInput` (`.../graphql/input-types/update-category.input.ts`): same four fields, all made optional — `@Field({ nullable: true })` + `@IsOptional()` prepended to each of the same validators above (a `titulo`/`icone`/`cor` sent as an empty string still fails its `@Length`/`@Matches` rule; only a fully-omitted field is allowed).
  - **Args Type:** `CategoryIdArgs` (`.../graphql/args/category-id.args.ts`) — `id: string`, `@Field(() => ID)` `@IsUUID({}, { message: 'validations.category_id_invalid' })`. Used to validate the `id` argument on `updateCategory` and `deleteCategory` (validated independently from the input/patch, via its own `validateInput(CategoryIdArgs, { id })` call).

- **Resolver:** `CategoryResolver` (`src/modules/category/resolvers/category.resolver.ts`), all four operations start with `const { id: userId } = requireCurrentUser(ctx)` (see new shared util below):
  - `@Mutation(() => CategoryType) createCategory(@Arg('input') input: CreateCategoryInput, @Ctx() ctx: GraphQLContext): Promise<CategoryType>`
  - `@Query(() => [CategoryType]) listCategories(@Ctx() ctx: GraphQLContext): Promise<CategoryType[]>`
  - `@Mutation(() => CategoryType) updateCategory(@Arg('id', () => ID) id: string, @Arg('input') input: UpdateCategoryInput, @Ctx() ctx: GraphQLContext): Promise<CategoryType>`
  - `@Mutation(() => Boolean) deleteCategory(@Arg('id', () => ID) id: string, @Ctx() ctx: GraphQLContext): Promise<boolean>` — returns `true` on success (no content to map back)

- **Mapper:** new `toCategoryType(category: Category): CategoryType` (`src/modules/category/mappers/category.mapper.ts`) — copies the five exposed fields 1:1.

- **DataLoader needed?** **No.** This feature adds no `@FieldResolver` and no relational field on any `@ObjectType()` — `Category` doesn't expose its owning `User`, and no other module's type resolves a `categories` relation yet (that's the future transaction feature's concern, out of scope here).

- **Complexity cost:** `listCategories` returns a flat, non-nested list scoped to one user (bounded to that user's own category count — realistically dozens, not thousands) — default complexity (`1`) applies, no explicit `complexity` override needed. Stated explicitly per the checklist rather than left implicit.

### Domain Events Blueprint

**Omitted:** no use-case above emits an event, and this feature doesn't subscribe to any existing event. The future transaction feature may want to react to category deletion (e.g., to null out a transaction's category reference) — that's a decision for that feature's own plan, not this one.

---

## Architectural Decisions

- **Scope & Requirements:** Authenticated users create/list/edit/delete their own categories (`titulo`, `descricao`, `icone`, `cor`). Out of scope (per `spec.md`): linking categories to transactions, seeded/default categories, sharing categories between users, custom ordering.
- **Data & State:** New `Category` table, one row per category, owned by exactly one `User` via `userId` (FK, `onDelete` left at Prisma's default `Restrict` — deleting a user with categories is not a flow this feature handles; revisit if/when account deletion ships). `@@unique([userId, titulo])` enforces no duplicate titles per user. Rows are hard-deleted by `deleteCategory` — no soft-delete/archival, matching the spec's plain "deletar" requirement.
- **User Experience:** Every failure mode maps to a client-actionable `extensions.code`:
  - Not authenticated → `UNAUTHENTICATED` (new shared `UnauthenticatedError`)
  - Malformed input (`titulo` empty, `cor` not `#RRGGBB`, `id` not a UUID) → `BAD_USER_INPUT` with field-level `validationErrors`
  - Duplicate `titulo` for the same user → `CONFLICT`
  - Editing/deleting another user's category, or a nonexistent one → `NOT_FOUND` (indistinguishable, per the grill-me decision — avoids confirming a given `id` belongs to someone else)
- **Testing & Validation:** Unit tests for `Category` entity (`create`, `fromRepository`, `belongsTo`), all four use-cases (mocked `CategoryRepository`), both input validations, `CategoryIdArgs` validation, and the mapper. Integration tests for `CategoryRepository` against the real database (`useDatabase()`), covering the unique constraint and the `P2025`/`P2002` translation paths. E2E tests executing real GraphQL documents for all four operations — happy path + each `extensions.code` above, plus the explicit cross-user isolation case (user A cannot see/edit/delete user B's category).
- **Implementation Details:** Touches only the new `category` module plus `prisma/schema.prisma` (new `Category` model + `User.categories` back-relation, required by Prisma for the FK) and `src/schema/build-schema.ts` (register `CategoryResolver`). No new npm dependencies. Reuses `generateUUID`, `validateInput`, `DomainError`/`ValidationError`, and the existing `formatError` pipeline unchanged. New shared addition: `requireCurrentUser(ctx: GraphQLContext): AuthenticatedUser` (`src/shared/utils/require-current-user.ts`) — throws the new `UnauthenticatedError` when `ctx.currentUser` is `null`, otherwise narrows and returns it; this is the first authenticated-only feature in the codebase, so this helper will be reused by every future protected resolver (transactions included). No breaking change to the existing schema — this feature only adds new types/operations. `schema.graphql` must be regenerated (`pnpm dev` or `pnpm build` runs `emitSchemaFile`) and committed as part of this PR.
- **Security Considerations:** Authentication via existing `ctx.currentUser` (JWT cookie, unchanged). Authorization is checked explicitly in every use-case that touches a specific row (`belongsTo`) — never inferred from a non-null `ctx.currentUser` alone, per `12-graphql-operational-concerns.md`. No new secrets. No timing concerns (no credential comparison here). No per-operation rate limiting beyond the server-wide query complexity/depth limits already configured.
- **Complex Workflows:** Not Applicable — every operation is a single atomic Prisma call (or two sequential calls for update/delete: read-then-write), no multi-step saga.
- **Cross-Cutting Concerns:** No new logging beyond the existing `formatError` server-side `console.error` for unexpected errors. No caching (per-request data, low volume). No new metrics beyond whatever error-rate-by-`extensions.code` monitoring already exists at the Apollo layer.
- **Error Scenarios & Failure Modes:** Database down → the Prisma call rejects with a non-`DomainError`/non-`GraphQLError` exception, which `formatError`'s fallback already masks as `INTERNAL_SERVER_ERROR` (no new handling needed here). Race condition (edit/delete racing a concurrent delete of the same row) → handled explicitly above via Prisma `P2025` → `CategoryNotFoundError`. No retries/timeouts beyond Prisma's own driver defaults — not warranted for single-row CRUD.
- **Performance & Scale:** Personal-finance category counts per user are expected to stay in the tens, not thousands — no pagination on `listCategories` (grill-me decision), no new index beyond the compound `@@unique([userId, titulo])` (which already serves as the natural lookup index for both the constraint and `findAllByUserId`'s `userId` filter).
- **Module Composition:** Single new module, `category`. It does not import from `user` or `auth` directly — the only cross-module data it needs is `ctx.currentUser.id`, already provided by the request context, so no port/adapter/gateway is required for this feature.
- **Deployment & Operations:** One new Prisma migration (`pnpm prisma:migrate:dev`) adding the `categories` table; rollback is the standard `prisma migrate` down-migration (drop table) since no existing data is touched. No feature flag — this is a net-new, additive set of operations with no interaction with existing clients.
- **Backward Compatibility:** Not Applicable — purely additive (new types, new queries/mutations). No existing field, type, or argument is changed or removed.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `Category` model to `prisma/schema.prisma`: `id String @id`, `userId String`, `titulo String`, `descricao String?`, `icone String`, `cor String`, `user User @relation(fields: [userId], references: [id])`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@unique([userId, titulo])`, `@@map("categories")`; add `categories Category[]` back-relation field to the existing `User` model. Run `pnpm prisma:migrate:dev` to generate the migration and `pnpm prisma:generate`.
- [ ] Implement `Category` entity (`src/modules/category/entity/category.entity.ts`): `CategoryProps`, `CreateCategoryProps`, `UpdateCategoryPatch` types; `create(props)`, `fromRepository(props)`, `belongsTo(userId)`.
- [ ] Unit tests for `Category` entity (`src/modules/category/__tests__/unit/entity/category-create-describe.test.ts`): `create` sets a generated `id` and copies all fields; `create` defaults `descricao` to whatever was passed (including `null`); `belongsTo` returns `true`/`false` correctly.
- [ ] Implement `CategoryNotFoundError` (`NOT_FOUND`, i18n key `errors.category_not_found`) and `CategoryAlreadyExistsError` (`CONFLICT`, i18n key `errors.category_already_exists`) in `src/modules/category/errors/category-errors.ts`.
- [ ] Implement shared `UnauthenticatedError` (`UNAUTHENTICATED`, i18n key `errors.unauthenticated`) in `src/shared/errors/unauthenticated-error.ts`; export it from `src/shared/errors/index.ts`.
- [ ] Add i18n keys (en + pt-br) to `src/services/i18n.service.ts`: `errors.category_not_found`, `errors.category_already_exists`, `errors.unauthenticated`, `validations.category_titulo_required`, `validations.category_descricao_max`, `validations.category_icone_required`, `validations.category_cor_format`, `validations.category_id_invalid`.
- [ ] Implement `CreateCategoryInput` and `UpdateCategoryInput` (`src/modules/category/graphql/input-types/{create,update}-category.input.ts`) and `CategoryIdArgs` (`src/modules/category/graphql/args/category-id.args.ts`) exactly per the GraphQL Blueprint field lists above.
- [ ] Implement validation wrappers `CreateCategoryValidation.validate`, `UpdateCategoryValidation.validate`, `CategoryIdValidation.validate` (`src/modules/category/validation/*.validation.ts`), each a thin `validateInput(...)` call.
- [ ] Unit tests for all three validations (`src/modules/category/__tests__/unit/validation/*-validation-describe.test.ts`): valid input passes; each individual field violation (`titulo` empty/too long, `descricao` over 500 chars, `icone` empty, `cor` not matching `#RRGGBB`, `id` not a UUID) throws `ValidationError` with the matching `path`.
- [ ] Implement `CategoryRepository` (`src/modules/category/repository/category.repository.ts`): `create`, `findById`, `findAllByUserId`, `update`, `remove` exactly per the Repository Blueprint, including the `P2002`/`P2025` translation.
- [ ] Integration tests for `CategoryRepository` (`src/modules/category/__tests__/integration/repository/category-repository-describe.test.ts`, using `useDatabase()`): `create` persists and returns the category; `create` throws `CategoryAlreadyExistsError` on a duplicate `(userId, titulo)`; `findById` returns the category / throws `CategoryNotFoundError` when missing; `findAllByUserId` returns only that user's categories, ordered by `createdAt`; `update` persists changes / throws `CategoryNotFoundError` for a missing id / throws `CategoryAlreadyExistsError` on a title collision; `remove` deletes the row / throws `CategoryNotFoundError` for a missing id.

### Phase 2: Features

- [ ] Implement `requireCurrentUser(ctx: GraphQLContext): AuthenticatedUser` in `src/shared/utils/require-current-user.ts`; export from `src/shared/utils/index.ts`.
- [ ] Unit tests for `requireCurrentUser` (`src/shared/utils/__tests__/unit/require-current-user-describe.test.ts`): returns `ctx.currentUser` when set; throws `UnauthenticatedError` when `ctx.currentUser` is `null`.
- [ ] Implement `CreateCategoryUseCase.createCategory`, `ListCategoriesUseCase.listCategories`, `UpdateCategoryUseCase.updateCategory`, `DeleteCategoryUseCase.deleteCategory` (`src/modules/category/use-cases/*.use-case.ts`) exactly per the Use-Case Blueprint's steps.
- [ ] Unit tests for all four use-cases (`src/modules/category/__tests__/unit/use-cases/*-describe.test.ts`, `CategoryRepository` mocked): `createCategory` happy path returns the created entity; `listCategories` returns whatever the repository returns for that `userId`; `updateCategory`/`deleteCategory` each cover every row of their Decision Table (not found, not owned → `CategoryNotFoundError`; owned → proceeds and calls the right repository method with the right args).
- [ ] Implement `CategoryType` object type (`src/modules/category/graphql/object-types/category.object-type.ts`) and `toCategoryType` mapper (`src/modules/category/mappers/category.mapper.ts`) per the GraphQL Blueprint field list.
- [ ] Unit tests for `toCategoryType` (`src/modules/category/__tests__/unit/mappers/category-mapper-describe.test.ts`): maps all five exposed fields, including `descricao: null`.
- [ ] Implement `CategoryResolver` (`src/modules/category/resolvers/category.resolver.ts`) with `createCategory`, `listCategories`, `updateCategory`, `deleteCategory` exactly per the Resolver signatures above — each starting with `requireCurrentUser(ctx)`, validating via the matching `*Validation.validate`, delegating to the matching use-case, mapping the result through `toCategoryType`.
- [ ] Register `CategoryResolver` in `src/schema/build-schema.ts`'s `resolvers` array.
- [ ] Create `src/modules/category/index.ts` barrel export: `Category` entity + its prop types, `CategoryRepository`, `CategoryNotFoundError`/`CategoryAlreadyExistsError`, `CategoryResolver` — no use-cases/validations/mappers exported, per `01-module-structure.md`.
- [ ] Run `pnpm dev` (or `pnpm build`) once to regenerate `schema.graphql`; commit the updated file.
- [ ] E2E tests (`src/modules/category/__tests__/integration/e2e/*-describe.test.ts`, real `executeOperation()` calls, `useDatabase()`): `createCategory` happy path + duplicate-`titulo` `CONFLICT` + invalid-`cor` `BAD_USER_INPUT` + unauthenticated `UNAUTHENTICATED`; `listCategories` returns only the caller's categories (seed two users' categories, assert isolation); `updateCategory` happy path + editing another user's category → `NOT_FOUND` + editing a nonexistent id → `NOT_FOUND`; `deleteCategory` happy path + deleting another user's category → `NOT_FOUND`.

### Phase 3: Polish

- [ ] Security review: confirm no test or resolver path ever returns `extensions.code: 'FORBIDDEN'` for category ownership (must always be `NOT_FOUND`, per the Architectural Decisions above) and that no error message leaks another user's `titulo`/`descricao` value.
- [ ] Confirm `pnpm build`, `pnpm lint`, and the full `pnpm test` suite (unit + integration + e2e) pass.
- [ ] Update `docs/features/PM-003-categorias/spec.md` acceptance criteria checkboxes to `[x]` as each is verified against the running e2e suite.

## Test Cases

### Phase 1: Foundation

- [ ] `Category.create()` generates an `id` and copies `userId`/`titulo`/`descricao`/`icone`/`cor`
- [ ] `Category.belongsTo()` returns `true` for the owning `userId`, `false` otherwise
- [ ] `CreateCategoryValidation`/`UpdateCategoryValidation` reject empty `titulo`, `descricao` over 500 chars, empty `icone`, and `cor` not matching `#RRGGBB`
- [ ] `CategoryIdValidation` rejects a non-UUID `id`
- [ ] `CategoryRepository.create` persists a category and throws `CategoryAlreadyExistsError` on a duplicate `(userId, titulo)`
- [ ] `CategoryRepository.findById` returns the category or throws `CategoryNotFoundError`
- [ ] `CategoryRepository.findAllByUserId` returns only the given user's categories
- [ ] `CategoryRepository.update`/`remove` throw `CategoryNotFoundError` for a missing id, and `update` throws `CategoryAlreadyExistsError` on a title collision

### Phase 2: Features

- [ ] `requireCurrentUser` returns the authenticated user or throws `UnauthenticatedError`
- [ ] `CreateCategoryUseCase.createCategory` happy path returns the created `Category`
- [ ] `ListCategoriesUseCase.listCategories` returns the repository's result for the given `userId`
- [ ] `UpdateCategoryUseCase.updateCategory` / `DeleteCategoryUseCase.deleteCategory`: not found → `CategoryNotFoundError`; not owned → `CategoryNotFoundError` (same as not found); owned → delegates to the repository
- [ ] `toCategoryType` maps every exposed field, including a `null` `descricao`
- [ ] `createCategory` mutation (e2e): happy path; duplicate `titulo` → `CONFLICT`; invalid `cor` → `BAD_USER_INPUT`; unauthenticated → `UNAUTHENTICATED`
- [ ] `listCategories` query (e2e): returns only the caller's own categories
- [ ] `updateCategory`/`deleteCategory` mutations (e2e): happy path; another user's category → `NOT_FOUND`; nonexistent id → `NOT_FOUND`

## Dependencies

- No new external packages.
- Internal: extends `prisma/schema.prisma` and `src/schema/build-schema.ts`; adds `src/shared/errors/unauthenticated-error.ts` and `src/shared/utils/require-current-user.ts` for reuse by future authenticated features (e.g. the upcoming transaction module).

## Risks & Mitigations

| Risk                                                                           | Impact | Mitigation                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_FOUND`-for-everything masks genuine bugs during manual testing            | Low    | Server-side logs still show the real Prisma/entity state; only the client-facing message is unified                                            |
| Read-then-write race on update/delete (two Prisma calls, not one atomic query) | Low    | Acceptable at this scale (single-user personal data, low write concurrency); `P2025` is caught and mapped explicitly rather than left to crash |
| Forgetting to regenerate `schema.graphql`                                      | Medium | Explicit Phase 2 task; CI/PR review should diff `schema.graphql` alongside the resolver changes                                                |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] Tests passing (unit + integration + e2e)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` committed, reflecting the four new category operations
