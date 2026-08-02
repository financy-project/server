# PM-001 Backend Tasks

## Phase 1: Foundation

- [x] B-001: Scaffold module skeletons: `node scripts/scaffold-module.js user` and `node scripts/scaffold-module.js auth`
- [x] B-002: Add `User` and `Auth` models to `prisma/schema.prisma`:
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
- [x] B-003: Implement `User` entity (`src/modules/user/entity/user.entity.ts`): `UserProps = { id: string; email: string; name: string }`, `CreateUserProps = Omit<UserProps, 'id'>`, `static create(props: CreateUserProps): User` (generates `id` via `generateUUID()`), `static fromRepository(props: UserProps): User`
- [x] B-004: Unit tests for `User` entity (`src/modules/user/__tests__/unit/entity/user-create-describe.test.ts`): `create` sets the provided `email`/`name` and generates a UUID `id`; `create` generates a unique `id` per call
- [x] B-005: Implement `Auth` entity (`src/modules/auth/entity/auth.entity.ts`): `AuthProps = { id: string; userId: string; password: string }`, `CreateAuthProps = Omit<AuthProps, 'id'>`, `static create(props: CreateAuthProps): Auth`, `static fromRepository(props: AuthProps): Auth`
- [x] B-006: Unit tests for `Auth` entity (`src/modules/auth/__tests__/unit/entity/auth-create-describe.test.ts`): `create` sets the provided `userId`/`password` and generates a UUID `id`
- [x] B-007: Implement `UserAlreadyExistsError` (`src/modules/user/errors/user-errors.ts`): extends `DomainError`, `constructor(message: string = 'errors.user_already_exists')`, code `'CONFLICT'`, `this.name = 'UserAlreadyExistsError'`, `Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)`

## Phase 2: Features

- [x] B-008: Implement `RegisterUserInput` (`src/modules/user/graphql/input-types/register-user.input.ts`) per the GraphQL Blueprint field list above
- [x] B-009: Implement `RegisterUserValidation` (`src/modules/user/validation/register-user.validation.ts`): `validate(input: RegisterUserInput): Promise<RegisterUserInput>` calling `validateInput(RegisterUserInput, input)`
- [x] B-010: Unit tests for `RegisterUserValidation` (`src/modules/user/__tests__/unit/validation/register-user-validation-describe.test.ts`): valid input passes through unchanged; invalid email throws `ValidationError`; password missing an uppercase letter/number or shorter than 8 chars throws `ValidationError`; empty/missing name throws `ValidationError`
- [x] B-011: Implement `UserRepository.existsByEmail` (`src/modules/user/repository/user.repository.ts`) per the Repository Blueprint above
- [x] B-012: Integration tests for `UserRepository.existsByEmail` (`src/modules/user/__tests__/integration/repository/user-repository-describe.test.ts`): returns `true` when a user with that email exists; returns `false` when no user has that email
- [x] B-013: Implement `CreateUserWithAuthRepository.createUserWithAuth` (`src/shared/database/create-user-with-auth.ts`) per the Repository Blueprint above
- [x] B-014: Integration tests for `CreateUserWithAuthRepository.createUserWithAuth` (`src/shared/__tests__/integration/create-user-with-auth-describe.test.ts`): creates both a `users` row and an `auth` row atomically and returns both entities; rejects with a Prisma `P2002` error when the email already exists, and creates neither row
- [x] B-015: Implement `HashService` (`src/services/hash.service.ts`): `hash(password: string): Promise<string>` via `bcryptjs.hash(password, 10)`; `compare(password: string, hashedPassword: string): Promise<boolean>` via `bcryptjs.compare` (needed now for symmetry/future login reuse even though `registerUser` only calls `hash`)
- [x] B-016: Implement `RegisterUserUseCase.registerUser` (`src/modules/user/use-cases/register-user.use-case.ts`) per the Use-Case Blueprint orchestration steps above
- [x] B-017: Unit tests for `RegisterUserUseCase.registerUser` (`src/modules/user/__tests__/unit/use-cases/register-user-describe.test.ts`, mocking `UserRepository`, `CreateUserWithAuthRepository`, and `HashService`): creates and returns a `User` when the email doesn't exist; throws `UserAlreadyExistsError` and never calls `CreateUserWithAuthRepository` when `existsByEmail` returns `true`; throws `UserAlreadyExistsError` when the transaction rejects with a `P2002` error; rethrows unmodified any other transaction error
- [x] B-018: Add i18n keys to `src/services/i18n.service.ts` (both `en` and `pt-br`): `errors.user_already_exists`, `validations.email`, `validations.name_required`, `validations.password_min`, `validations.password_uppercase`, `validations.password_number`

## Phase 3: Polish

- [x] B-019: Implement `UserType` (`src/modules/user/graphql/object-types/user.object-type.ts`) per the GraphQL Blueprint above
- [x] B-020: Implement `toUserType` mapper (`src/modules/user/mappers/user.mapper.ts`): `(user: User) => UserType`, maps `id`/`email`/`name` only
- [x] B-021: Unit tests for `toUserType` (`src/modules/user/__tests__/unit/mappers/user-mapper-describe.test.ts`): maps every `UserType` field from the entity; the returned object has no password/hash property
- [ ] B-022: Implement `UserResolver` (`src/modules/user/resolvers/user.resolver.ts`): `@Resolver()`, `@Mutation(() => UserType) registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType>` — validates via `RegisterUserValidation.validate`, delegates to `RegisterUserUseCase.registerUser`, returns `toUserType(user)`
- [ ] B-023: Register `UserResolver` in `src/schema/build-schema.ts` (`resolvers: [HealthResolver, UserResolver]`)
- [ ] B-024: Update barrel `src/modules/user/index.ts`: export `User`; type `UserProps`, `CreateUserProps`; `UserRepository`; `UserAlreadyExistsError`; `UserResolver`
- [ ] B-025: Update barrel `src/modules/auth/index.ts`: export `Auth`; type `AuthProps`, `CreateAuthProps`
- [ ] B-026: E2E tests (`src/modules/user/__tests__/integration/e2e/register-user-describe.test.ts`, using `buildApolloServer()` from `@/app` + `useDatabase()`, matching the pattern in `src/modules/health/__tests__/integration/e2e/health-describe.test.ts`): happy path returns `{ id, email, name }` with no `errors`; registering the same email twice returns `errors[0].extensions.code === 'CONFLICT'`; weak password / invalid email / missing name each return `errors[0].extensions.code === 'BAD_USER_INPUT'`
- [ ] B-027: Run `pnpm dev` (or `pnpm build`) once to regenerate `schema.graphql`, then commit it
