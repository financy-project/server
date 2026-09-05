# Logout - PM-025

## Description

Add a `logout` mutation that clears the HttpOnly access-token cookie set by `login`, ending the client's session.

## Users

Any user with an active session (authenticated via the `access_token` cookie).

## Acceptance Criteria

- [x] `logout: Boolean!` mutation is exposed on the `AuthResolver`
- [x] Calling `logout` clears the `access_token` cookie (`Max-Age=0`, same `httpOnly`/`secure`/`sameSite`/`path` as login)
- [x] Mutation returns `true` and succeeds even without a valid session cookie (idempotent, no auth error)

## Out of Scope

- Server-side token revocation/blacklisting (the JWT itself stays valid until natural expiry, only the cookie is cleared)
- Refresh tokens
