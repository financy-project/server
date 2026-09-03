## Definition of Ready (DoR) Blueprints

### Entity Blueprint

- **Entity Name:** `Category` (`src/modules/category/entity/category.entity.ts`)
- **Properties:**
  ```ts
  type CategoryProps = {
    id: string
    userId: string
    title: string
    description: string | null
    icon: string
    color: string
  }

  type CreateCategoryProps = Omit<CategoryProps, 'id'>

  type UpdateCategoryPatch = Partial<
    Pick<CategoryProps, 'title' | 'description' | 'icon' | 'color'>
  >
  ```
- **Methods:**
  - `static create(props: CreateCategoryProps): Category` — generates `id` via `generateUUID()`
  - `static fromRepository(props: CategoryProps): Category`
  - `belongsTo(userId: string): boolean` — `return this.userId === userId`; the single ownership rule every use-case below relies on to decide `NOT_FOUND` vs proceed

### Repository Blueprint

- **Repository Name:** `CategoryRepository` (`src/modules/category/repository/category.repository.ts`)
- **Methods:**
  - `create(category: Category): Promise<Category>` — `prisma.category.create()`; catches `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'` (violates the `@@unique([userId, title])` constraint) and rethrows `CategoryAlreadyExistsError`
  - `findById(id: string): Promise<Category>` — `prisma.category.findUnique({ where: { id } })`; throws `CategoryNotFoundError(id)` if not found (same convention as `UserRepository.findById`). Does **not** check ownership — that's the use-case's job via `Category.belongsTo()`
  - `findAllByUserId(userId: string): Promise<Category[]>` — `prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })`
  - `update(id: string, patch: UpdateCategoryPatch): Promise<Category>` — `prisma.category.update({ where: { id }, data: patch })`; catches `P2025` (row deleted between the use-case's ownership check and this call) → rethrows `CategoryNotFoundError(id)`; catches `P2002` → rethrows `CategoryAlreadyExistsError`
  - `remove(id: string): Promise<void>` — `prisma.category.delete({ where: { id } })`; catches `P2025` → rethrows `CategoryNotFoundError(id)`
- **Data Mapping:** 1:1 — the Prisma model's columns are named identically to the entity's props (`title`, `description`, `icon`, `color`), so `Category.fromRepository(row)` needs no field renaming.

### Use-Case Blueprint

- **`CreateCategoryUseCase.createCategory(input: CreateCategoryProps): Promise<Category>`** (`src/modules/category/use-cases/create-category.use-case.ts`)
  - Steps: 1. `Category.create(input)` 2. `CategoryRepository.create(category)` (repository translates `P2002` → `CategoryAlreadyExistsError`) 3. return the created `Category`
  - Decision Table: not required — single linear path; the only failure mode (duplicate `title` for the same user) is translated by the repository, not branched on here.

- **`ListCategoriesUseCase.listCategories(userId: string): Promise<Category[]>`** (`src/modules/category/use-cases/list-categories.use-case.ts`)
  - Steps: 1. return `CategoryRepository.findAllByUserId(userId)`
  - Decision Table: not required — no branching.

- **`UpdateCategoryUseCase.updateCategory(input: { id: string; userId: string; patch: UpdateCategoryPatch }): Promise<Category>`** (`src/modules/category/use-cases/update-category.use-case.ts`)
  - Steps: 1. `category = await CategoryRepository.findById(id)` 2. if `!category.belongsTo(userId)` throw `CategoryNotFoundError(id)` 3. `return await CategoryRepository.update(id, patch)`
  - Decision Table:

    | Condition                                                     | Outcome                                                                                                                                                        |
    | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | No row with `id` exists                                         | `CategoryRepository.findById` throws `CategoryNotFoundError`                                                                                                  |
    | Row exists, `category.belongsTo(userId)` is `false`             | Use-case throws `CategoryNotFoundError` — **same error/message** as the row-missing case, so a client can never distinguish "not yours" from "doesn't exist" |
    | Row exists, `category.belongsTo(userId)` is `true`              | Proceeds to `CategoryRepository.update`                                                                                                                        |
    | Row deleted between step 1 and step 3 (race)                    | `CategoryRepository.update` catches Prisma `P2025`, throws `CategoryNotFoundError`                                                                             |
    | `patch.title` collides with another of the user's categories    | `CategoryRepository.update` catches `P2002`, throws `CategoryAlreadyExistsError`                                                                               |

- **`DeleteCategoryUseCase.deleteCategory(input: { id: string; userId: string }): Promise<void>`** (`src/modules/category/use-cases/delete-category.use-case.ts`)
  - Steps: 1. `category = await CategoryRepository.findById(id)` 2. if `!category.belongsTo(userId)` throw `CategoryNotFoundError(id)` 3. `await CategoryRepository.remove(id)`
  - Decision Table: identical shape to `UpdateCategoryUseCase`'s first three rows (no `title` collision row, since delete has no conflicting field), plus the same race-condition row ending in `CategoryRepository.remove` catching `P2025` → `CategoryNotFoundError`.

  **Emitted Events:** none — see Domain Events Blueprint.

### GraphQL Blueprint

- **Object Type:** `CategoryType` (`src/modules/category/graphql/object-types/category.object-type.ts`)

  | Field         | GraphQL type | Nullable |
  | ------------- | ------------ | -------- |
  | `id`          | `ID!`        | No       |
  | `title`       | `String!`    | No       |
  | `description` | `String`     | Yes      |
  | `icon`        | `String!`    | No       |
  | `color`       | `String!`    | No       |

  (`userId` is intentionally **not** exposed — ownership is implicit via `ctx.currentUser`, never a client-supplied or client-visible field.)

- **Input Types:**
  - `CreateCategoryInput` (`.../graphql/input-types/create-category.input.ts`):
    - `title: string` — `@Field()` `@Length(1, 100, { message: 'validations.category_title_required' })`
    - `description?: string` — `@Field({ nullable: true })` `@IsOptional()` `@MaxLength(500, { message: 'validations.category_description_max' })`
    - `icon: string` — `@Field()` `@Length(1, 100, { message: 'validations.category_icon_required' })`
    - `color: string` — `@Field()` `@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'validations.category_color_format' })`
  - `UpdateCategoryInput` (`.../graphql/input-types/update-category.input.ts`): same four fields, all made optional — `@Field({ nullable: true })` + `@IsOptional()` prepended to each of the same validators above (a `title`/`icon`/`color` sent as an empty string still fails its `@Length`/`@Matches` rule; only a fully-omitted field is allowed).
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
