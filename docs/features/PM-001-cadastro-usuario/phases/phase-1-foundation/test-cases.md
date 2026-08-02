## Phase 1: Foundation

- [x] T-001: `User.create()` sets provided `email`/`name` and generates a UUID `id`
- [x] T-002: `User.create()` generates a unique `id` per call
- [ ] T-003: `Auth.create()` sets provided `userId`/`password` and generates a UUID `id`
- [ ] T-004: `UserAlreadyExistsError` has `code === 'CONFLICT'` and `instanceof DomainError`

