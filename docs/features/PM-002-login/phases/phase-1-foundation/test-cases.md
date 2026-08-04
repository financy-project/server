## Phase 1: Foundation

- [ ] T-001: `JwtService.sign()` returns a JWT string containing the `sub` claim
- [ ] T-002: `JwtService.verify()` returns `{ sub }` for a token it signed itself
- [ ] T-003: `JwtService.verify()` returns `null` for a malformed token
- [ ] T-004: `JwtService.verify()` returns `null` for an expired token
- [ ] T-005: `parseCookies()` parses multiple `key=value` pairs, an empty string, and `undefined`
- [ ] T-006: `serializeCookie()` includes `HttpOnly`, conditional `Secure`, `SameSite`, `Path`, `Max-Age`
- [ ] T-007: `parseDurationToSeconds('7d')` → `604800`; `'1h'` → `3600`; `'30m'` → `1800`; `'45s'` → `45`
- [ ] T-008: `FindUserWithAuthByEmailRepository.findUserWithAuthByEmail()` returns `{ user, auth }` when found, `null` when not found
