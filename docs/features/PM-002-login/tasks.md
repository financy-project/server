# login - PM-002 - Tasks

Generated verbatim from `plan.md`'s `## Implementation Phases`. See `phases/phase-N-slug/` for per-phase slices (`tasks.md`, `test-cases.md`, `blueprint.md`) used by `/workflow`.

## Phase 1: Foundation

- [x] B-001: Add `jsonwebtoken` and `@types/jsonwebtoken` (dev) to `package.json`
- [x] B-002: Implement `JwtService` (`src/services/jwt.service.ts`): `sign(payload: { sub: string }): string` (uses `Environments.jwtSecret`, `expiresIn: Environments.jwtExpiry`), `verify(token: string): { sub: string } | null` (catches `jsonwebtoken` errors — expired, malformed, bad signature — and returns `null` rather than throwing)
- [x] B-003: Implement cookie utilities (`src/shared/utils/cookies.ts`): `parseCookies(header: string | undefined): Record<string, string>`, `serializeCookie(name: string, value: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; path?: string; maxAgeSeconds?: number }): string`
- [x] B-004: Implement `parseDurationToSeconds(value: string): number` (`src/shared/utils/parse-duration.ts`) supporting `s`/`m`/`h`/`d` suffixes (e.g. `'7d'` → `604800`), used to derive the cookie's `Max-Age` from `Environments.jwtExpiry`
- [x] B-005: Add constants (`src/utils/constants/auth.constant.ts` + barrel `src/utils/constants/index.ts`): `ACCESS_TOKEN_COOKIE_NAME = 'access_token'`, `DUMMY_PASSWORD_HASH` (a pre-computed bcrypt hash of a fixed random string, used only for timing-safe comparison)
- [x] B-006: Implement `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(email)` (`src/shared/database/find-user-with-auth-by-email.ts`) per the Repository Blueprint
- [x] B-007: Unit tests for `JwtService`: `sign` returns a decodable JWT string with `sub` claim; `verify` returns `{ sub }` for a token signed by `sign`; `verify` returns `null` for a malformed token; `verify` returns `null` for an expired token (sign with `expiresIn: '-1s'`)
- [x] B-008: Unit tests for cookie utilities: `parseCookies` handles multiple cookies, empty string, and `undefined` header; `serializeCookie` includes `HttpOnly`, `Secure` (only when requested), `SameSite`, `Path`, and `Max-Age` in the output string
- [x] B-009: Unit tests for `parseDurationToSeconds`: `'7d'` → `604800`, `'1h'` → `3600`, `'30m'` → `1800`, `'45s'` → `45`
- [x] B-010: Integration test for `FindUserWithAuthByEmailRepository` (`src/shared/database/__tests__/integration/find-user-with-auth-by-email-describe.test.ts`): returns `{ user, auth }` when a user+auth row exists; returns `null` when no user matches the email

## Phase 2: Features

- [x] B-011: Implement `InvalidCredentialsError` (`src/modules/auth/errors/auth-errors.ts`) extending `DomainError` with code `UNAUTHENTICATED` and message `errors.invalid_credentials`; update `src/modules/auth/errors/index.ts` barrel
- [x] B-012: Add i18n keys to `src/services/i18n.service.ts`: `errors.invalid_credentials` (en: "Invalid email or password", pt-br: "E-mail ou senha inválidos"), `validations.password_required` (en: "Password is required", pt-br: "A senha é obrigatória")
- [x] B-013: Implement `LoginInput` (`src/modules/auth/graphql/input-types/login.input.ts`) per the GraphQL Blueprint field list; update `src/modules/auth/graphql/input-types/index.ts` barrel
- [x] B-014: Implement `LoginValidation.validate(input: LoginInput): Promise<LoginInput>` (`src/modules/auth/validation/login.validation.ts`), calling `validateInput(LoginInput, input)`; update `src/modules/auth/validation/index.ts` barrel
- [x] B-015: Implement `LoginUseCase.login(input: { email, password }): Promise<{ user: User; token: string }>` (`src/modules/auth/use-cases/login.use-case.ts`) per the Use-Case Blueprint's orchestration steps and Decision Table; update `src/modules/auth/use-cases/index.ts` barrel
- [x] B-016: Implement `toAuthenticatedUserType(user: User): UserType` (`src/modules/auth/mappers/auth.mapper.ts`); update `src/modules/auth/mappers/index.ts` barrel
- [x] B-017: Add `cookies: { get(name: string): string | undefined; set(name: string, value: string, options?: CookieOptions): void }` to `GraphQLContext` (`src/context/create-context.ts`); change `createContext` to accept `{ req, res }: { req: IncomingMessage; res: ServerResponse }`; implement `resolveCurrentUser(req)` using `parseCookies(req.headers.cookie)` + `JwtService.verify` to read the `access_token` cookie and populate `currentUser` (replaces the existing placeholder comment/`return null`)
- [x] B-018: Implement `AuthResolver.login` (`src/modules/auth/resolvers/auth.resolver.ts`) per the GraphQL Blueprint: validates via `LoginValidation`, calls `LoginUseCase.login`, calls `ctx.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token, { httpOnly: true, secure: Environments.isProduction, sameSite: 'lax', path: '/', maxAgeSeconds: parseDurationToSeconds(Environments.jwtExpiry) })`, returns `toAuthenticatedUserType(user)`; update `src/modules/auth/resolvers/index.ts` barrel
- [x] B-019: Update `src/modules/auth/index.ts` public barrel: export `AuthResolver` and `InvalidCredentialsError`
- [ ] B-020: Update `src/modules/user/index.ts` public barrel: export `UserType` from `./graphql/object-types`
- [ ] B-021: Register `AuthResolver` in `src/schema/build-schema.ts` (`resolvers: [HealthResolver, UserResolver, AuthResolver]`)
- [ ] B-022: Unit tests for `LoginInput`/`LoginValidation` (`src/modules/auth/__tests__/unit/validation/login-validation-describe.test.ts`): valid email+non-empty password passes; invalid email format → `validations.email`; empty password → `validations.password_required`
- [ ] B-023: Unit tests for `LoginUseCase` (`src/modules/auth/__tests__/unit/use-cases/login-describe.test.ts`, mocked `FindUserWithAuthByEmailRepository`/`HashService`/`JwtService`): unknown email → throws `InvalidCredentialsError` and still calls `HashService.compare`; known email + wrong password → throws `InvalidCredentialsError`; known email + correct password → returns `{ user, token }` and calls `JwtService.sign` with `{ sub: user.id }`
- [ ] B-024: Unit tests for `createContext` (`src/context/__tests__/unit/create-context-describe.test.ts`): no `cookie` header → `currentUser: null`; valid `access_token` cookie (signed via `JwtService.sign`) → `currentUser: { id: sub }`; invalid/expired token → `currentUser: null`
- [ ] B-025: E2E tests for `login` mutation (`src/modules/auth/__tests__/integration/e2e/login-describe.test.ts`, using `useDatabase()` + `buildApolloServer()`, seeding a user via `registerUser` first): happy path — correct credentials → `data.login` matches `{ id, email, name }`, `errors` undefined, injected `contextValue.cookies.set` spy called once with `ACCESS_TOKEN_COOKIE_NAME` and `httpOnly: true`; wrong password → `errors[0].extensions.code === 'UNAUTHENTICATED'`; unknown email → `errors[0].extensions.code === 'UNAUTHENTICATED'` (same code as wrong password); malformed input (invalid email format / empty password) → `errors[0].extensions.code === 'BAD_USER_INPUT'`

## Phase 3: Polish

- [ ] B-026: Regenerate `schema.graphql` (`pnpm build` or dev server run triggers `emitSchemaFile`) and commit the diff (new `login` mutation, new `LoginInput` type)
- [ ] B-027: Review that `console.error`/logging paths never log `input.password` or the issued `token` (spot-check `LoginUseCase`, `AuthResolver`, `formatError`)
- [ ] B-028: Confirm `pnpm build` compiles cleanly with the new `jsonwebtoken` dependency and updated `GraphQLContext` shape
