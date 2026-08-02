# cadastro-usuario - PM-001

## Description

Self-signup: an anonymous visitor creates their own account by submitting name, email, and password. No email verification step — the account is active immediately after registration.

## Users

Anonymous visitor (not yet authenticated).

## Acceptance Criteria

- [ ] Visitor can submit name, email, and password to create an account
- [ ] Password is hashed before being persisted (never stored or returned in plaintext)
- [ ] Email must be unique — duplicate registration is rejected
- [ ] Created user is returned (or otherwise confirmed) without exposing the password/hash

## Out of Scope

- Email verification / confirmation flow
- Social login (Google, GitHub, etc.)
- Two-factor authentication (2FA)
- Password recovery / reset
