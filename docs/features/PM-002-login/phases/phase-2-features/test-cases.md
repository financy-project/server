## Phase 2: Features

- [x] T-009: `LoginInput` valid email + non-empty password passes validation
- [x] T-010: `LoginInput` invalid email format → `validations.email`
- [x] T-011: `LoginInput` empty password → `validations.password_required`
- [x] T-012: `LoginUseCase.login` unknown email → throws `InvalidCredentialsError`, still invokes `HashService.compare` (timing-safe branch)
- [x] T-013: `LoginUseCase.login` known email + wrong password → throws `InvalidCredentialsError`
- [x] T-014: `LoginUseCase.login` known email + correct password → returns `{ user, token }`, calls `JwtService.sign({ sub: user.id })`
- [x] T-015: `createContext` no cookie header → `currentUser: null`
- [x] T-016: `createContext` valid `access_token` cookie → `currentUser: { id }`
- [x] T-017: `createContext` invalid/expired `access_token` cookie → `currentUser: null`
- [x] T-018: `login` mutation happy path → returns `{ id, email, name }`, no errors, `cookies.set` called with `access_token` + `httpOnly: true`
- [x] T-019: `login` mutation wrong password → `extensions.code: 'UNAUTHENTICATED'`
- [x] T-020: `login` mutation unknown email → `extensions.code: 'UNAUTHENTICATED'` (identical to wrong-password case)
- [x] T-021: `login` mutation malformed input → `extensions.code: 'BAD_USER_INPUT'`
