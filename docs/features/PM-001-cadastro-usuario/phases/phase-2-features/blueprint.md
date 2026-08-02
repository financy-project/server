# PM-001 Blueprints (from plan.md, unmodified — same content in every phase folder)


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
