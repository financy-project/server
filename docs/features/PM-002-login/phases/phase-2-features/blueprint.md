## Definition of Ready (DoR) Blueprints

This plan must explicitly define the architectural layers per [docs/architecture/11-dor.md](../../../../architecture/11-dor.md). Each blueprint below should be fully specified, or marked `**Omitted:**` with justification.

### Entity Blueprint

**Omitted:** `User` (`src/modules/user/entity/user.entity.ts`) and `Auth` (`src/modules/auth/entity/auth.entity.ts`) already exist from PM-001 and need no new properties or methods. Login only reads them — no new business rules, no new entity.

### Repository Blueprint

- **Repository Name:** `FindUserWithAuthByEmailRepository` — new, in `src/shared/database/find-user-with-auth-by-email.ts`, mirroring the existing `CreateUserWithAuthRepository` (`src/shared/database/create-user-with-auth.ts`) precedent for cross-module User+Auth data access.
- **Methods:**
  - `findUserWithAuthByEmail(email: string): Promise<{ user: User; auth: Auth } | null>` — single Prisma query: `prisma.user.findUnique({ where: { email }, include: { auth: true } })`. Returns `null` if no user row matches.
- **Data Mapping:** Prisma `user` row → `User.fromRepository({ id, email, name })`; Prisma `auth` row (from the included relation) → `Auth.fromRepository({ id, userId, password })`. If the `auth` relation is unexpectedly missing for a found user, treat as `null` overall (data integrity issue, not a valid login target).

**Why this location, not a repository inside `auth` or `user`:** the query spans both modules' tables in one join; `shared/database/` is the established convention for that (see `create-user-with-auth.ts`), avoiding a new ports/adapters/gateway layer for a single read.

### Use-Case Blueprint

- **Use-Case Name:** `LoginUseCase`, `src/modules/auth/use-cases/login.use-case.ts`
- **Inputs/Outputs:**
  - Input: `{ email: string; password: string }` (plain object, not the GraphQL input type)
  - Output: `Promise<{ user: User; token: string }>` — entities/primitives only, never GraphQL types
- **Orchestration Steps:**
  1. `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(input.email)` → `result: { user, auth } | null`
  2. `passwordHash = result?.auth.password ?? DUMMY_PASSWORD_HASH` (constant from `src/utils/constants/auth.constant.ts`)
  3. `isValid = await HashService.compare(input.password, passwordHash)` — **always executed**, even when `result` is `null`, so response timing doesn't reveal whether the email exists
  4. If `!result || !isValid`, throw `InvalidCredentialsError`
  5. `token = JwtService.sign({ sub: result.user.id })`
  6. Return `{ user: result.user, token }`
- **Decision Table:**

  | Condition                                | Outcome                                                                                                           |
  | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | No user found for email                   | still run `HashService.compare` against `DUMMY_PASSWORD_HASH` (timing-safe), then throw `InvalidCredentialsError` |
  | User found, password does not match hash  | throw `InvalidCredentialsError`                                                                                    |
  | User found, password matches hash         | sign JWT (`sub: user.id`), return `{ user, token }`                                                                |

- **Emitted Events:** none (see Domain Events Blueprint below).

### GraphQL Blueprint

- **Object Type:** reuse existing `UserType` (`src/modules/user/graphql/object-types/user.object-type.ts` — `id: ID!`, `email: String!`, `name: String!`). No new object type; the mutation returns the logged-in user's profile, matching `registerUser`'s existing shape. The JWT itself is **not** a GraphQL field — it travels only as an HttpOnly cookie (see Security Considerations).
- **Input Type:** `LoginInput`, new, `src/modules/auth/graphql/input-types/login.input.ts`:
  ```ts
  @InputType()
  export class LoginInput {
    @Field()
    @IsEmail({}, { message: 'validations.email' })
    email!: string

    @Field()
    @IsString()
    @IsNotEmpty({ message: 'validations.password_required' })
    password!: string
  }
  ```
  (No password-complexity rules here — those are registration policy, not a login credential check.)
- **Resolver Name & Operation:** `AuthResolver.login`, new, `src/modules/auth/resolvers/auth.resolver.ts`:
  ```ts
  @Mutation(() => UserType)
  async login(
    @Arg('input') input: LoginInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<UserType>
  ```
  Sets the `access_token` cookie via `ctx.cookies.set(...)` after a successful `LoginUseCase.login`, then returns `toAuthenticatedUserType(user)`.
- **Mapper:** new `toAuthenticatedUserType(user: User): UserType` in `src/modules/auth/mappers/auth.mapper.ts`. Auth module owns its own thin mapper rather than importing `user` module's private `toUserType` (mappers are never barrel-exported, per each module's `index.ts` convention).
- **DataLoader needed?** No — no relational/list field is added.
- **Complexity cost:** default (1) — `login` is a single scalar-object mutation, not list-returning or deeply nested.

**Barrel/isolation amendment required:** `src/modules/user/index.ts` currently only exports `entity, types, enums, errors, repository, resolver` (not object-types). This plan adds `export { UserType } from './graphql/object-types'` to that public barrel, since `AuthResolver` needs the canonical `UserType` to avoid a duplicate near-identical GraphQL type. The mapper stays private to `user`; only the `@ObjectType()` class itself becomes public.

### Domain Events Blueprint

**Omitted:** no event is emitted or consumed. A `user.logged_in` audit event is a reasonable future feature but out of scope here per the "out of scope" decision on rate limiting/lockout (no consumer would exist yet).
