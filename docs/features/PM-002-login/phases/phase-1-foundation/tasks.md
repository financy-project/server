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
