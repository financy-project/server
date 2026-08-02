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
