# login - PM-002 - Test Cases

Generated verbatim from `plan.md`'s `## Test Cases`. See `phases/phase-N-slug/test-cases.md` for per-phase slices used by `/workflow`.

## Phase 1: Foundation

- [x] T-001: `JwtService.sign()` returns a JWT string containing the `sub` claim
- [x] T-002: `JwtService.verify()` returns `{ sub }` for a token it signed itself
- [x] T-003: `JwtService.verify()` returns `null` for a malformed token
- [x] T-004: `JwtService.verify()` returns `null` for an expired token
- [x] T-005: `parseCookies()` parses multiple `key=value` pairs, an empty string, and `undefined`
- [x] T-006: `serializeCookie()` includes `HttpOnly`, conditional `Secure`, `SameSite`, `Path`, `Max-Age`
- [x] T-007: `parseDurationToSeconds('7d')` → `604800`; `'1h'` → `3600`; `'30m'` → `1800`; `'45s'` → `45`
- [x] T-008: `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail()` returns `{ user, auth }` when found, `null` when not found

## Phase 2: Features

- [ ] T-009: `LoginInput` valid email + non-empty password passes validation
- [ ] T-010: `LoginInput` invalid email format → `validations.email`
- [ ] T-011: `LoginInput` empty password → `validations.password_required`
- [ ] T-012: `LoginUseCase.login` unknown email → throws `InvalidCredentialsError`, still invokes `HashService.compare` (timing-safe branch)
- [ ] T-013: `LoginUseCase.login` known email + wrong password → throws `InvalidCredentialsError`
- [ ] T-014: `LoginUseCase.login` known email + correct password → returns `{ user, token }`, calls `JwtService.sign({ sub: user.id })`
- [ ] T-015: `createContext` no cookie header → `currentUser: null`
- [ ] T-016: `createContext` valid `access_token` cookie → `currentUser: { id }`
- [ ] T-017: `createContext` invalid/expired `access_token` cookie → `currentUser: null`
- [ ] T-018: `login` mutation happy path → returns `{ id, email, name }`, no errors, `cookies.set` called with `access_token` + `httpOnly: true`
- [ ] T-019: `login` mutation wrong password → `extensions.code: 'UNAUTHENTICATED'`
- [ ] T-020: `login` mutation unknown email → `extensions.code: 'UNAUTHENTICATED'` (identical to wrong-password case)
- [ ] T-021: `login` mutation malformed input → `extensions.code: 'BAD_USER_INPUT'`

## Phase 3: Polish

- [ ] T-022: `schema.graphql` diff reviewed and committed
- [ ] T-023: No password or token value appears in any log statement touched by this feature
