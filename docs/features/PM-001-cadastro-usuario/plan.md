# cadastro-usuario - PM-001 - Implementation Plan

## Definition of Ready (DoR) Blueprints

### Entity Blueprint

**Entity 1: `User`** (module `user`)

```ts
export type UserProps = {
  id: string
  email: string
  name: string
}

export type CreateUserProps = Omit<UserProps, 'id'>
```

- **Methods:** none beyond `create()` / `fromRepository()` — no business rules needed for this feature (no lifecycle/status yet, see Architectural Decisions).

**Entity 2: `Auth`** (module `auth`)

```ts
export type AuthProps = {
  id: string
  userId: string
  password: string // already hashed by the time the entity is constructed
}

export type CreateAuthProps = Omit<AuthProps, 'id'>
```

- **Methods:** none beyond `create()` / `fromRepository()` — password comparison (`matches()`) belongs to a future login feature, not this one.

### Repository Blueprint

**`UserRepository`** (module `user`)

- **Methods:**
  - `existsByEmail(email: string): Promise<boolean>` — `prisma.user.count({ where: { email } }) > 0`. Chosen over a throwing `findByEmail()` because "email not found" is the _expected_ happy path during registration, not an error condition — using exceptions for that control flow would be an anti-pattern. (Deviates from 03-repository.md's `findByEmail` example on purpose; see Architectural Decisions.)
- **Data Mapping:** none beyond `User.fromRepository()` — no relation loaded.

**`CreateUserWithAuthRepository`** (shared, `src/shared/database/create-user-with-auth.ts`) — per [03-repository.md's "Multi-Module Operations"](../../architecture/03-repository.md#multi-module-operations)

- **Method:** `createUserWithAuth(input: { user: User; auth: Auth }): Promise<{ user: User; auth: Auth }>`
- **Data Mapping:** issues `prisma.user.create` + `prisma.auth.create` inside a single `prisma.$transaction([...])` (atomic — both rows or neither), returns both via `.fromRepository()`.

**`AuthRepository`: Omitted.** No standalone read/write access to the `auth` table is needed by this feature — the only write path is the shared transactional insert above. A future login feature will add `AuthRepository.findByUserId`.

### Use-Case Blueprint

**`RegisterUserUseCase`** (module `user` — see Module Composition below for why, not `auth`)

- **Inputs/Outputs:** `registerUser(input: RegisterUserInput): Promise<User>`
- **Orchestration Steps:**
  1. `UserRepository.existsByEmail(input.email)`
  2. If it returns `true` → throw `UserAlreadyExistsError(input.email)`
  3. `User.create({ email: input.email, name: input.name })`
  4. `HashService.hash(input.password)` → `hashedPassword`
  5. `Auth.create({ userId: user.id, password: hashedPassword })`
  6. `CreateUserWithAuthRepository.createUserWithAuth({ user, auth })`, wrapped in `try/catch`: if the transaction rejects with a Prisma unique-constraint violation (`error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'`), throw `UserAlreadyExistsError(input.email)` instead (race-condition safety net — see Error Scenarios); any other error rethrows unmodified
  7. Return `user`
- **Decision Table:**

  | Condition                                                                  | Outcome                        |
  | -------------------------------------------------------------------------- | ------------------------------ |
  | `existsByEmail(email)` → `true`                                            | throw `UserAlreadyExistsError` |
  | `existsByEmail(email)` → `false`, transaction succeeds                     | return created `User`          |
  | `existsByEmail(email)` → `false`, transaction rejects with `P2002`         | throw `UserAlreadyExistsError` |
  | `existsByEmail(email)` → `false`, transaction rejects with any other error | rethrow unmodified             |

- **Emitted Events:** none — see Domain Events Blueprint.

### GraphQL Blueprint

- **Object Type:** `UserType` (module `user`, `graphql/object-types/user.object-type.ts`)
  - `id: ID!` (`@Field(() => ID)`)
  - `email: String!` (`@Field()`)
  - `name: String!` (`@Field()`)
  - Never a password/hash field.
- **Input Type:** `RegisterUserInput` (module `user`, `graphql/input-types/register-user.input.ts`)
  - `email: String!` — `@IsEmail({}, { message: 'validations.email' })`
  - `name: String!` — `@Length(1, 255, { message: 'validations.name_required' })`
  - `password: String!` — `@MinLength(8, { message: 'validations.password_min' })`, `@Matches(/[A-Z]/, { message: 'validations.password_uppercase' })`, `@Matches(/[0-9]/, { message: 'validations.password_number' })`
- **Resolver Name & Operation:** `UserResolver` (module `user`), `@Mutation(() => UserType) registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType>`
- **Mapper:** `toUserType` (module `user`, new) — maps `id`/`email`/`name`.
- **DataLoader needed?** No — single mutation, no relational field exposed on `UserType`.
- **Complexity cost:** default — not a list-returning or deeply-nested field.

### Domain Events Blueprint

**Omitted:** no use-case in this plan emits an event, and nothing consumes one. `listenersRegistrator.ts` stays untouched. A future "send welcome email" feature can add `user.created` then, with a real consumer to wire.

## Architectural Decisions

- **Scope & Requirements:** Self-signup only — anonymous visitor submits name/email/password, account is active immediately (no email verification). Success = a `registerUser` mutation that persists the user, hashes the password, rejects duplicate emails, and never returns/stores the password in plaintext. Out of scope: email verification, social login, 2FA, password recovery, login itself (no session/JWT issued by this feature).
- **Data & State:** New `users` and `auth` tables (1:1 via `auth.userId`). `users.email` is unique (application-level `existsByEmail` check + DB unique constraint as the source of truth for races). No retention/archival policy needed yet — rows live indefinitely until a future account-deletion feature exists.
- **User Experience:** Happy path returns `{ id, email, name }`. Duplicate email → `extensions.code: 'CONFLICT'` (doesn't leak whether it's a timing/race case vs. a pre-existing user — same error either way). Invalid input (bad email, weak password, missing name) → `extensions.code: 'BAD_USER_INPUT'` with field-level `validationErrors` from `ValidationError.metadata`.
- **Testing & Validation:** Unit tests (mocked) for `User`/`Auth` entities, `RegisterUserValidation`, `RegisterUserUseCase`, `toUserType`. Integration tests (real DB) for `UserRepository.existsByEmail` and `CreateUserWithAuthRepository.createUserWithAuth`, including the `P2002` race path. E2E test executing the real `registerUser` GraphQL mutation for: happy path, duplicate email (`CONFLICT`), and each validation failure (`BAD_USER_INPUT`).
- **Implementation Details:** Touches modules `user` (new) and `auth` (new, minimal), plus shared (`src/shared/database/`, `src/services/hash.service.ts`). No new npm packages — `bcryptjs`, `class-validator`, `class-transformer`, `uuidv7` are already dependencies. No relational field → no DataLoader. This is a new mutation on a schema that currently only has `health` — not a breaking change. `schema.graphql` must be regenerated (`emitSchemaFile` already wired in `build-schema.ts`) and committed once `UserResolver` is registered.
- **Security Considerations:** Password hashed with `bcryptjs` (cost factor 10, matching [09-configuration.md](../../architecture/09-configuration.md)'s documented default) before it ever reaches the repository layer — the use-case, not the entity, calls `HashService.hash()`. `UserType`/`toUserType` never expose the hash. No authentication/session concerns in this feature (registration only, no login). Per-operation authorization: N/A, this mutation is intentionally open to anonymous visitors. Rate limiting: explicitly **out of scope** per product decision — no rate-limiting infra exists in the project yet; revisit when a general strategy is designed (tracked as a follow-up, not a task here).
- **Complex Workflows:** Not a saga — the two inserts (`users`, `auth`) are wrapped in one `prisma.$transaction`, so it's atomic: both rows exist or neither does. No compensation logic needed.
- **Cross-Cutting Concerns:** No new logging beyond the existing `formatError` console.error path for unexpected errors. Nothing in this feature logs the raw password or the hash, and no future logging should either. No caching (registration is a write, not a cacheable read). Monitoring/metrics: Not Applicable — no metrics/tracing infrastructure exists in the project yet.
- **Error Scenarios & Failure Modes:** DB unreachable → Prisma throws, bubbles up unmodified, `formatError`'s default `INTERNAL_SERVER_ERROR` path handles it (existing behavior, nothing feature-specific needed). Concurrent duplicate registration (race between `existsByEmail` and the transaction) → caught via Prisma `P2002` and translated to `UserAlreadyExistsError` (see Use-Case orchestration step 6). No retry/timeout logic — single synchronous DB transaction, default driver timeout is sufficient for an MVP.
- **Performance & Scale:** No pagination (single-object mutation, not a list). `users.email` unique index (also serves the `existsByEmail` lookup) and `auth.userId` unique index (enforces the 1:1 relation) are added by the migration. No specific throughput/latency target given for this feature.
- **Module Composition:** Split `user` + `auth` modules per product decision, bridged by a shared `CreateUserWithAuthRepository` (matches [03-repository.md](../../architecture/03-repository.md#multi-module-operations)'s documented pattern for multi-module atomic writes). **Deviation from docs 05/07's worked example:** those chapters put `RegisterUserInput`/`RegisterUserValidation`/`RegisterUserUseCase`/the resolver in the `auth` module — but 07's own resolver snippet then does `import { toUserType } from '@/modules/user/mappers/user.mapper'`, which is simultaneously a deep import (bypassing the barrel) and a reach into `mappers/`, which [01-module-structure.md](../../architecture/01-module-structure.md#barrel-export) explicitly says is **not** exported. That's not a pattern this plan can follow without violating one of the two stated rules. Since `UserType`/`toUserType` unambiguously belong to `user` (per 01, 02, 03, 06 — only 05/07 disagree), this plan keeps `RegisterUserInput`, `RegisterUserValidation`, `RegisterUserUseCase`, and `UserResolver` all in the **`user`** module instead. The `auth` module is reduced to owning just the `Auth` entity for this feature (barrel-exported, so the use-case and the shared repository can import it cleanly); a future login feature will add `AuthRepository`, `InvalidCredentialsError`, `AuthResolver`, etc. there.
- **Deployment & Operations:** One new Prisma migration adding `users` and `auth` (`pnpm prisma:migrate:dev --name add_user_and_auth`). No data migration (new tables, no existing rows). No feature flag — no such infra exists yet. Rollback = revert the migration; no production data at risk since these are brand-new tables.
- **Backward Compatibility:** Not Applicable — first version of these types/fields, nothing existing to break.

## Implementation Phases

### Phase 1: Foundation

- [ ] Scaffold module skeletons: `node scripts/scaffold-module.js user` and `node scripts/scaffold-module.js auth`
- [ ] Add `User` and `Auth` models to `prisma/schema.prisma`:
  ```prisma
  model User {
    id        String   @id
    email     String   @unique
    name      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("users")
  }

  model Auth {
    id        String   @id
    userId    String   @unique
    password  String
    user      User     @relation(fields: [userId], references: [id])
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("auth")
  }
  ```
  Run `pnpm prisma:migrate:dev --name add_user_and_auth`, then `pnpm prisma:generate`.
- [ ] Implement `User` entity (`src/modules/user/entity/user.entity.ts`): `UserProps = { id: string; email: string; name: string }`, `CreateUserProps = Omit<UserProps, 'id'>`, `static create(props: CreateUserProps): User` (generates `id` via `generateUUID()`), `static fromRepository(props: UserProps): User`
- [ ] Unit tests for `User` entity (`src/modules/user/__tests__/unit/entity/user-create-describe.test.ts`): `create` sets the provided `email`/`name` and generates a UUID `id`; `create` generates a unique `id` per call
- [ ] Implement `Auth` entity (`src/modules/auth/entity/auth.entity.ts`): `AuthProps = { id: string; userId: string; password: string }`, `CreateAuthProps = Omit<AuthProps, 'id'>`, `static create(props: CreateAuthProps): Auth`, `static fromRepository(props: AuthProps): Auth`
- [ ] Unit tests for `Auth` entity (`src/modules/auth/__tests__/unit/entity/auth-create-describe.test.ts`): `create` sets the provided `userId`/`password` and generates a UUID `id`
- [ ] Implement `UserAlreadyExistsError` (`src/modules/user/errors/user-errors.ts`): extends `DomainError`, `constructor(message: string = 'errors.user_already_exists')`, code `'CONFLICT'`, `this.name = 'UserAlreadyExistsError'`, `Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)`

### Phase 2: Features

- [ ] Implement `RegisterUserInput` (`src/modules/user/graphql/input-types/register-user.input.ts`) per the GraphQL Blueprint field list above
- [ ] Implement `RegisterUserValidation` (`src/modules/user/validation/register-user.validation.ts`): `validate(input: RegisterUserInput): Promise<RegisterUserInput>` calling `validateInput(RegisterUserInput, input)`
- [ ] Unit tests for `RegisterUserValidation` (`src/modules/user/__tests__/unit/validation/register-user-validation-describe.test.ts`): valid input passes through unchanged; invalid email throws `ValidationError`; password missing an uppercase letter/number or shorter than 8 chars throws `ValidationError`; empty/missing name throws `ValidationError`
- [ ] Implement `UserRepository.existsByEmail` (`src/modules/user/repository/user.repository.ts`) per the Repository Blueprint above
- [ ] Integration tests for `UserRepository.existsByEmail` (`src/modules/user/__tests__/integration/repository/user-repository-describe.test.ts`): returns `true` when a user with that email exists; returns `false` when no user has that email
- [ ] Implement `CreateUserWithAuthRepository.createUserWithAuth` (`src/shared/database/create-user-with-auth.ts`) per the Repository Blueprint above
- [ ] Integration tests for `CreateUserWithAuthRepository.createUserWithAuth` (`src/shared/__tests__/integration/create-user-with-auth-describe.test.ts`): creates both a `users` row and an `auth` row atomically and returns both entities; rejects with a Prisma `P2002` error when the email already exists, and creates neither row
- [ ] Implement `HashService` (`src/services/hash.service.ts`): `hash(password: string): Promise<string>` via `bcryptjs.hash(password, 10)`; `compare(password: string, hashedPassword: string): Promise<boolean>` via `bcryptjs.compare` (needed now for symmetry/future login reuse even though `registerUser` only calls `hash`)
- [ ] Implement `RegisterUserUseCase.registerUser` (`src/modules/user/use-cases/register-user.use-case.ts`) per the Use-Case Blueprint orchestration steps above
- [ ] Unit tests for `RegisterUserUseCase.registerUser` (`src/modules/user/__tests__/unit/use-cases/register-user-describe.test.ts`, mocking `UserRepository`, `CreateUserWithAuthRepository`, and `HashService`): creates and returns a `User` when the email doesn't exist; throws `UserAlreadyExistsError` and never calls `CreateUserWithAuthRepository` when `existsByEmail` returns `true`; throws `UserAlreadyExistsError` when the transaction rejects with a `P2002` error; rethrows unmodified any other transaction error
- [ ] Add i18n keys to `src/services/i18n.service.ts` (both `en` and `pt-br`): `errors.user_already_exists`, `validations.email`, `validations.name_required`, `validations.password_min`, `validations.password_uppercase`, `validations.password_number`

### Phase 3: Polish

- [ ] Implement `UserType` (`src/modules/user/graphql/object-types/user.object-type.ts`) per the GraphQL Blueprint above
- [ ] Implement `toUserType` mapper (`src/modules/user/mappers/user.mapper.ts`): `(user: User) => UserType`, maps `id`/`email`/`name` only
- [ ] Unit tests for `toUserType` (`src/modules/user/__tests__/unit/mappers/user-mapper-describe.test.ts`): maps every `UserType` field from the entity; the returned object has no password/hash property
- [ ] Implement `UserResolver` (`src/modules/user/resolvers/user.resolver.ts`): `@Resolver()`, `@Mutation(() => UserType) registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType>` — validates via `RegisterUserValidation.validate`, delegates to `RegisterUserUseCase.registerUser`, returns `toUserType(user)`
- [ ] Register `UserResolver` in `src/schema/build-schema.ts` (`resolvers: [HealthResolver, UserResolver]`)
- [ ] Update barrel `src/modules/user/index.ts`: export `User`; type `UserProps`, `CreateUserProps`; `UserRepository`; `UserAlreadyExistsError`; `UserResolver`
- [ ] Update barrel `src/modules/auth/index.ts`: export `Auth`; type `AuthProps`, `CreateAuthProps`
- [ ] E2E tests (`src/modules/user/__tests__/integration/e2e/register-user-describe.test.ts`, using `buildApolloServer()` from `@/app` + `useDatabase()`, matching the pattern in `src/modules/health/__tests__/integration/e2e/health-describe.test.ts`): happy path returns `{ id, email, name }` with no `errors`; registering the same email twice returns `errors[0].extensions.code === 'CONFLICT'`; weak password / invalid email / missing name each return `errors[0].extensions.code === 'BAD_USER_INPUT'`
- [ ] Run `pnpm dev` (or `pnpm build`) once to regenerate `schema.graphql`, then commit it

## Test Cases

### Phase 1: Foundation

- [ ] `User.create()` sets provided `email`/`name` and generates a UUID `id`
- [ ] `User.create()` generates a unique `id` per call
- [ ] `Auth.create()` sets provided `userId`/`password` and generates a UUID `id`
- [ ] `UserAlreadyExistsError` has `code === 'CONFLICT'` and `instanceof DomainError`

### Phase 2: Features

- [ ] `RegisterUserValidation.validate` passes through valid input unchanged
- [ ] `RegisterUserValidation.validate` throws `ValidationError` for invalid email
- [ ] `RegisterUserValidation.validate` throws `ValidationError` for a password missing an uppercase letter, missing a number, or under 8 characters
- [ ] `RegisterUserValidation.validate` throws `ValidationError` for an empty/missing name
- [ ] `UserRepository.existsByEmail` returns `true` for an existing email
- [ ] `UserRepository.existsByEmail` returns `false` for a non-existent email
- [ ] `CreateUserWithAuthRepository.createUserWithAuth` creates both rows atomically and returns both entities
- [ ] `CreateUserWithAuthRepository.createUserWithAuth` rejects with `P2002` on duplicate email, creating neither row
- [ ] `RegisterUserUseCase.registerUser` creates and returns a `User` when the email doesn't exist (happy path — Decision Table row 2)
- [ ] `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` when `existsByEmail` is `true`, without calling `CreateUserWithAuthRepository` (Decision Table row 1)
- [ ] `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` on a `P2002` race (Decision Table row 3)

### Phase 3: Polish

- [ ] `toUserType` maps `id`/`email`/`name` and exposes no password/hash field
- [ ] `registerUser` mutation happy path: returns `{ id, email, name }`, no `errors`
- [ ] `registerUser` mutation duplicate email: `errors[0].extensions.code === 'CONFLICT'`
- [ ] `registerUser` mutation invalid input (bad email / weak password / missing name): `errors[0].extensions.code === 'BAD_USER_INPUT'` with field-level `validationErrors`

## Dependencies

- No new npm packages — `bcryptjs`, `class-validator`, `class-transformer`, `uuidv7` are already installed.
- Internal: `user` module depends on `auth` module's barrel-exported `Auth` entity; both depend on the shared `HashService` and `CreateUserWithAuthRepository`.

## Risks & Mitigations

| Risk                                                                     | Impact | Mitigation                                                                                                                     |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Docs 05/07 vs. 01/02/03/06 disagree on module ownership for registration | Medium | Resolved explicitly in Module Composition above; documented as an intentional deviation, not an oversight                      |
| Race condition: two concurrent registrations with the same email         | Medium | `existsByEmail` pre-check + `P2002` catch on the transaction as a safety net; DB unique constraint is the real source of truth |
| First real Prisma migration in the project                               | Low    | Exercised via existing `docker:dev`/`docker:integration`/`docker:e2e` tooling before merging                                   |
| No rate limiting on a public signup mutation                             | Low    | Explicitly out of scope per product decision; flagged here for a future dedicated rate-limiting story                          |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] All tests passing (`pnpm test`, `pnpm test:integration`, `pnpm test:e2e`)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` regenerated and committed
- [ ] `UserResolver` registered in `src/schema/build-schema.ts`
- [ ] No password or password hash ever logged, returned, or exposed on `UserType`
