# login - PM-002 - Implementation Plan

## Definition of Ready (DoR) Blueprints

This plan must explicitly define the architectural layers per [docs/architecture/11-dor.md](../../architecture/11-dor.md). Each blueprint below should be fully specified, or marked `**Omitted:**` with justification.

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
  | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
  | No user found for email                  | still run `HashService.compare` against `DUMMY_PASSWORD_HASH` (timing-safe), then throw `InvalidCredentialsError` |
  | User found, password does not match hash | throw `InvalidCredentialsError`                                                                                   |
  | User found, password matches hash        | sign JWT (`sub: user.id`), return `{ user, token }`                                                               |

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

---

## Architectural Decisions

- **Scope & Requirements:** Ship a `login(input: LoginInput!): User!` mutation. Success: valid email+password → the JWT is set as an **HttpOnly cookie**, and the mutation response returns the user's `id`, `email`, `name` (decided: "token http only e o nome do usuario"). Explicitly **out of scope**: a `me` query or any protected query/field consuming `ctx.currentUser` (decided: deferred to a later feature), brute-force lockout/rate-limiting on login attempts (decided: deferred), logout/token refresh/token revocation.
- **Data & State:** No new tables/columns. Reads existing `user` + `auth` rows (joined). No new record created by login itself. The JWT is stateless (no server-side session store) — nothing to retain or expire server-side; the cookie's `Max-Age` matches `Environments.jwtExpiry`.
- **User Experience:** Happy path: correct credentials → `data.login = { id, email, name }`, `errors` undefined, `Set-Cookie: access_token=...; HttpOnly; ...` present on the HTTP response. Any credential failure (unknown email **or** wrong password) → identical `extensions.code: 'UNAUTHENTICATED'` and identical message key `errors.invalid_credentials`, so a client (or attacker) cannot distinguish "no such user" from "wrong password". Malformed input (bad email format, empty password) → `extensions.code: 'BAD_USER_INPUT'`.
- **Testing & Validation:** Unit tests for `LoginUseCase` (mocked repository/services), `JwtService`, cookie/duration utilities, and `createContext`'s cookie→`currentUser` resolution. Integration test for `FindUserWithAuthByEmailRepository` against the real DB. E2E test executing the actual `login` mutation via `executeOperation`, injecting a fake `contextValue.cookies` (`get`/`set` spies) since there's no real HTTP layer in tests — asserting both the GraphQL response body and that `cookies.set` was called with the right name/flags.
- **Implementation Details:** Touches `auth` module (new), `user` module (barrel amendment only), `src/context/create-context.ts`, `src/schema/build-schema.ts`, `src/shared/database/`, `src/shared/utils/`, `src/utils/constants/`, `src/services/`. New dependency: `jsonwebtoken` (+ `@types/jsonwebtoken` dev). Reuses `HashService`, `Environments.jwtSecret`/`jwtExpiry`, `DomainError`, `validateInput`. No relational field added, no DataLoader. `schema.graphql` **does** need regenerating (new `login` mutation + `LoginInput` type) and committing.
- **Security Considerations:** Password verified via existing `HashService` (bcryptjs) — never compared in plaintext. JWT signed with `Environments.jwtSecret` (HS256, default), payload `{ sub: userId }` only — no email/PII in the token. Token delivered exclusively via `HttpOnly`, `SameSite=Lax` cookie (`Secure` when `Environments.isProduction`) — never returned as a plain GraphQL string field, so it isn't logged in query/response logs or exposed to XSS via `document.cookie`. Timing-safe: `HashService.compare` always runs, even for a nonexistent email, against a fixed `DUMMY_PASSWORD_HASH`, so response latency doesn't leak whether an account exists. Authorization: N/A — `login` requires no prior authentication. Rate limiting / lockout: **explicitly out of scope for this feature** (decided) — the global `GRAPHQL_COMPLEXITY_LIMIT`/`GRAPHQL_DEPTH_LIMIT` plugins offer no brute-force protection; flagging this as a follow-up feature (e.g. a future PM ticket for per-IP/per-email throttling).
- **Complex Workflows:** Not applicable — `login` is a single synchronous read-then-verify operation, no multi-step/async workflow.
- **Cross-Cutting Concerns:** Log login **failures** at a level useful for security monitoring (email attempted, not password) without logging the password or the issued token; success is not specially logged beyond default request logging. No caching (credentials must always be freshly checked). No new metrics beyond the existing per-`extensions.code` error visibility already provided by `formatError`. No request correlation ID work needed — none exists in the codebase yet, so not introduced here.
- **Error Scenarios & Failure Modes:** Database unavailable → the Prisma call throws, propagates unhandled through the use-case/resolver to Apollo's `formatError`, which already has a generic `INTERNAL_SERVER_ERROR` branch for anything that isn't a `DomainError`/`ValidationError` — no bespoke handling added, consistent with how `registerUser` behaves today. No race condition risk (`login` performs no writes). No retries/timeouts introduced — none exist elsewhere in the codebase for Prisma calls, so not introduced here either.
- **Performance & Scale:** Single indexed lookup (`user.email` is already `@unique`, per PM-001's schema) plus one joined `auth` row via its `@unique` `userId` — no new index needed. No list-returning field, so no pagination concern.
- **Module Composition:** `auth` module owns `LoginUseCase`/`AuthResolver`/`LoginInput` (authentication is its responsibility). `user` module's barrel gains one export (`UserType`) as described in the GraphQL Blueprint. The User+Auth join lives in `shared/database/`, following the exact precedent of `CreateUserWithAuthRepository` rather than introducing a new ports/adapters/gateway layer for a single cross-module read.
- **Deployment & Operations:** No Prisma migration — `user`/`auth` tables already exist (`prisma/migrations/20260802000000_add_user_and_auth`). Rollback is a plain revert (stateless JWTs, no server-side session data to clean up). No feature flag — `login` is additive (a new mutation), so it can't break existing clients. Post-deploy monitoring: watch `UNAUTHENTICATED` error rate on `login` via existing `formatError` extensions-code visibility.
- **Backward Compatibility:** Not applicable — this is a purely additive schema change (new `login` mutation, new `LoginInput` type). No existing field, type, or argument is touched or renamed.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `jsonwebtoken` and `@types/jsonwebtoken` (dev) to `package.json`
- [ ] Implement `JwtService` (`src/services/jwt.service.ts`): `sign(payload: { sub: string }): string` (uses `Environments.jwtSecret`, `expiresIn: Environments.jwtExpiry`), `verify(token: string): { sub: string } | null` (catches `jsonwebtoken` errors — expired, malformed, bad signature — and returns `null` rather than throwing)
- [ ] Implement cookie utilities (`src/shared/utils/cookies.ts`): `parseCookies(header: string | undefined): Record<string, string>`, `serializeCookie(name: string, value: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; path?: string; maxAgeSeconds?: number }): string`
- [ ] Implement `parseDurationToSeconds(value: string): number` (`src/shared/utils/parse-duration.ts`) supporting `s`/`m`/`h`/`d` suffixes (e.g. `'7d'` → `604800`), used to derive the cookie's `Max-Age` from `Environments.jwtExpiry`
- [ ] Add constants (`src/utils/constants/auth.constant.ts` + barrel `src/utils/constants/index.ts`): `ACCESS_TOKEN_COOKIE_NAME = 'access_token'`, `DUMMY_PASSWORD_HASH` (a pre-computed bcrypt hash of a fixed random string, used only for timing-safe comparison)
- [ ] Implement `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(email)` (`src/shared/database/find-user-with-auth-by-email.ts`) per the Repository Blueprint
- [ ] Unit tests for `JwtService`: `sign` returns a decodable JWT string with `sub` claim; `verify` returns `{ sub }` for a token signed by `sign`; `verify` returns `null` for a malformed token; `verify` returns `null` for an expired token (sign with `expiresIn: '-1s'`)
- [ ] Unit tests for cookie utilities: `parseCookies` handles multiple cookies, empty string, and `undefined` header; `serializeCookie` includes `HttpOnly`, `Secure` (only when requested), `SameSite`, `Path`, and `Max-Age` in the output string
- [ ] Unit tests for `parseDurationToSeconds`: `'7d'` → `604800`, `'1h'` → `3600`, `'30m'` → `1800`, `'45s'` → `45`
- [ ] Integration test for `FindUserWithAuthByEmailRepository` (`src/shared/database/__tests__/integration/find-user-with-auth-by-email-describe.test.ts`): returns `{ user, auth }` when a user+auth row exists; returns `null` when no user matches the email

### Phase 2: Features

- [ ] Implement `InvalidCredentialsError` (`src/modules/auth/errors/auth-errors.ts`) extending `DomainError` with code `UNAUTHENTICATED` and message `errors.invalid_credentials`; update `src/modules/auth/errors/index.ts` barrel
- [ ] Add i18n keys to `src/services/i18n.service.ts`: `errors.invalid_credentials` (en: "Invalid email or password", pt-br: "E-mail ou senha inválidos"), `validations.password_required` (en: "Password is required", pt-br: "A senha é obrigatória")
- [ ] Implement `LoginInput` (`src/modules/auth/graphql/input-types/login.input.ts`) per the GraphQL Blueprint field list above; update `src/modules/auth/graphql/input-types/index.ts` barrel
- [ ] Implement `LoginValidation.validate(input: LoginInput): Promise<LoginInput>` (`src/modules/auth/validation/login.validation.ts`), calling `validateInput(LoginInput, input)`; update `src/modules/auth/validation/index.ts` barrel
- [ ] Implement `LoginUseCase.login(input: { email, password }): Promise<{ user: User; token: string }>` (`src/modules/auth/use-cases/login.use-case.ts`) per the Use-Case Blueprint's orchestration steps and Decision Table; update `src/modules/auth/use-cases/index.ts` barrel
- [ ] Implement `toAuthenticatedUserType(user: User): UserType` (`src/modules/auth/mappers/auth.mapper.ts`); update `src/modules/auth/mappers/index.ts` barrel
- [ ] Add `cookies: { get(name: string): string | undefined; set(name: string, value: string, options?: CookieOptions): void }` to `GraphQLContext` (`src/context/create-context.ts`); change `createContext` to accept `{ req, res }: { req: IncomingMessage; res: ServerResponse }`; implement `resolveCurrentUser(req)` using `parseCookies(req.headers.cookie)` + `JwtService.verify` to read the `access_token` cookie and populate `currentUser` (replaces the existing placeholder comment/`return null`)
- [ ] Implement `AuthResolver.login` (`src/modules/auth/resolvers/auth.resolver.ts`) per the GraphQL Blueprint: validates via `LoginValidation`, calls `LoginUseCase.login`, calls `ctx.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token, { httpOnly: true, secure: Environments.isProduction, sameSite: 'lax', path: '/', maxAgeSeconds: parseDurationToSeconds(Environments.jwtExpiry) })`, returns `toAuthenticatedUserType(user)`; update `src/modules/auth/resolvers/index.ts` barrel
- [ ] Update `src/modules/auth/index.ts` public barrel: export `AuthResolver` and `InvalidCredentialsError`
- [ ] Update `src/modules/user/index.ts` public barrel: export `UserType` from `./graphql/object-types`
- [ ] Register `AuthResolver` in `src/schema/build-schema.ts` (`resolvers: [HealthResolver, UserResolver, AuthResolver]`)
- [ ] Unit tests for `LoginInput`/`LoginValidation` (`src/modules/auth/__tests__/unit/validation/login-validation-describe.test.ts`): valid email+non-empty password passes; invalid email format → `validations.email`; empty password → `validations.password_required`
- [ ] Unit tests for `LoginUseCase` (`src/modules/auth/__tests__/unit/use-cases/login-describe.test.ts`, mocked `FindUserWithAuthByEmailRepository`/`HashService`/`JwtService`): unknown email → throws `InvalidCredentialsError` and still calls `HashService.compare`; known email + wrong password → throws `InvalidCredentialsError`; known email + correct password → returns `{ user, token }` and calls `JwtService.sign` with `{ sub: user.id }`
- [ ] Unit tests for `createContext` (`src/context/__tests__/unit/create-context-describe.test.ts`): no `cookie` header → `currentUser: null`; valid `access_token` cookie (signed via `JwtService.sign`) → `currentUser: { id: sub }`; invalid/expired token → `currentUser: null`
- [ ] E2E tests for `login` mutation (`src/modules/auth/__tests__/integration/e2e/login-describe.test.ts`, using `useDatabase()` + `buildApolloServer()`, seeding a user via `registerUser` first): happy path — correct credentials → `data.login` matches `{ id, email, name }`, `errors` undefined, injected `contextValue.cookies.set` spy called once with `ACCESS_TOKEN_COOKIE_NAME` and `httpOnly: true`; wrong password → `errors[0].extensions.code === 'UNAUTHENTICATED'`; unknown email → `errors[0].extensions.code === 'UNAUTHENTICATED'` (same code as wrong password); malformed input (invalid email format / empty password) → `errors[0].extensions.code === 'BAD_USER_INPUT'`

### Phase 3: Polish

- [ ] Regenerate `schema.graphql` (`pnpm build` or dev server run triggers `emitSchemaFile`) and commit the diff (new `login` mutation, new `LoginInput` type)
- [ ] Review that `console.error`/logging paths never log `input.password` or the issued `token` (spot-check `LoginUseCase`, `AuthResolver`, `formatError`)
- [ ] Confirm `pnpm build` compiles cleanly with the new `jsonwebtoken` dependency and updated `GraphQLContext` shape

## Test Cases

Sibling to Implementation Phases, same `### Phase N:` grouping — every entry traces to a Decision Table row, Entity/Service method, or GraphQL Blueprint response case above.

### Phase 1: Foundation

- [ ] `JwtService.sign()` returns a JWT string containing the `sub` claim
- [ ] `JwtService.verify()` returns `{ sub }` for a token it signed itself
- [ ] `JwtService.verify()` returns `null` for a malformed token
- [ ] `JwtService.verify()` returns `null` for an expired token
- [ ] `parseCookies()` parses multiple `key=value` pairs, an empty string, and `undefined`
- [ ] `serializeCookie()` includes `HttpOnly`, conditional `Secure`, `SameSite`, `Path`, `Max-Age`
- [ ] `parseDurationToSeconds('7d')` → `604800`; `'1h'` → `3600`; `'30m'` → `1800`; `'45s'` → `45`
- [ ] `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail()` returns `{ user, auth }` when found, `null` when not found

### Phase 2: Features

- [ ] `LoginInput` valid email + non-empty password passes validation
- [ ] `LoginInput` invalid email format → `validations.email`
- [ ] `LoginInput` empty password → `validations.password_required`
- [ ] `LoginUseCase.login` unknown email → throws `InvalidCredentialsError`, still invokes `HashService.compare` (timing-safe branch)
- [ ] `LoginUseCase.login` known email + wrong password → throws `InvalidCredentialsError`
- [ ] `LoginUseCase.login` known email + correct password → returns `{ user, token }`, calls `JwtService.sign({ sub: user.id })`
- [ ] `createContext` no cookie header → `currentUser: null`
- [ ] `createContext` valid `access_token` cookie → `currentUser: { id }`
- [ ] `createContext` invalid/expired `access_token` cookie → `currentUser: null`
- [ ] `login` mutation happy path → returns `{ id, email, name }`, no errors, `cookies.set` called with `access_token` + `httpOnly: true`
- [ ] `login` mutation wrong password → `extensions.code: 'UNAUTHENTICATED'`
- [ ] `login` mutation unknown email → `extensions.code: 'UNAUTHENTICATED'` (identical to wrong-password case)
- [ ] `login` mutation malformed input → `extensions.code: 'BAD_USER_INPUT'`

### Phase 3: Polish

- [ ] `schema.graphql` diff reviewed and committed
- [ ] No password or token value appears in any log statement touched by this feature

## Dependencies

- **External:** `jsonwebtoken` (JWT sign/verify), `@types/jsonwebtoken` (dev)
- **Internal:** `HashService` (`src/services/hash.service.ts`), `Environments.jwtSecret`/`jwtExpiry`/`isProduction` (`src/config/environments.ts`), `DomainError`/`ValidationError` (`src/shared/errors`), `validateInput` (`src/shared/utils/validate-input.ts`), `User` and `Auth` entities (PM-001), `CreateUserWithAuthRepository` precedent (`src/shared/database/create-user-with-auth.ts`)

## Risks & Mitigations

| Risk                                                                                  | Impact | Mitigation                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `me`/protected query exists yet to exercise `currentUser` end-to-end via GraphQL   | Medium | Cover `createContext`'s cookie→`currentUser` resolution with direct unit tests instead of relying on an e2e query; a follow-up feature adds the first protected field |
| No brute-force protection on `login`                                                  | Medium | Explicitly called out as deferred scope (decided); track as a follow-up feature/ticket                                                                                |
| `user/index.ts` barrel gains a new export (`UserType`), a structural precedent change | Low    | Scoped narrowly to the object type only; mapper stays private, keeping module isolation intact for business logic                                                     |
| Cookie-based JWT delivery is new to this codebase (no prior precedent)                | Low    | Isolated in small, independently unit-testable utilities (`cookies.ts`, `parse-duration.ts`, `JwtService`) rather than inlined in the resolver                        |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met (see note below — `spec.md` still needs its placeholder fields filled in from the decisions captured in this plan)
- [ ] All tests passing (`pnpm test`)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` committed with the new `login` mutation and `LoginInput` type
