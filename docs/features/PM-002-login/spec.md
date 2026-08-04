# login - PM-002

## Description

Registered users authenticate with email + password. On success, the server issues a JWT delivered as an HttpOnly cookie, and the mutation response returns the user's profile (id, email, name).

## Users

End users of the Financy app who have already registered an account (via `registerUser`, PM-001).

## Acceptance Criteria

- [ ] A user can call `login(input: { email, password })` with correct credentials and receive their `id`, `email`, `name` back with no errors
- [ ] On successful login, the response sets an `HttpOnly` cookie (`access_token`) containing a JWT valid per `JWT_EXPIRY`; the token is never returned as a plain GraphQL field
- [ ] Wrong password or unknown email both return the same error (`extensions.code: 'UNAUTHENTICATED'`, message "Invalid email or password") — a client cannot tell which one was wrong
- [ ] Malformed input (invalid email format, empty password) returns `extensions.code: 'BAD_USER_INPUT'`
- [ ] Login attempts are timing-safe — response time doesn't reveal whether the email exists

## Out of Scope

- A `me` query or any other field/query that consumes the authenticated `currentUser` — deferred to a later feature
- Brute-force protection: rate limiting or account lockout on repeated failed attempts — deferred to a later feature
- Logout, token refresh, and token revocation
