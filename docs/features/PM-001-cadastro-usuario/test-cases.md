# PM-001 Test Cases

## Phase 1: Foundation

- [x] T-001: `User.create()` sets provided `email`/`name` and generates a UUID `id`
- [x] T-002: `User.create()` generates a unique `id` per call
- [x] T-003: `Auth.create()` sets provided `userId`/`password` and generates a UUID `id`
- [x] T-004: `UserAlreadyExistsError` has `code === 'CONFLICT'` and `instanceof DomainError`

## Phase 2: Features

- [x] T-005: `RegisterUserValidation.validate` passes through valid input unchanged
- [x] T-006: `RegisterUserValidation.validate` throws `ValidationError` for invalid email
- [x] T-007: `RegisterUserValidation.validate` throws `ValidationError` for a password missing an uppercase letter, missing a number, or under 8 characters
- [x] T-008: `RegisterUserValidation.validate` throws `ValidationError` for an empty/missing name
- [x] T-009: `UserRepository.existsByEmail` returns `true` for an existing email
- [x] T-010: `UserRepository.existsByEmail` returns `false` for a non-existent email
- [x] T-011: `CreateUserWithAuthRepository.createUserWithAuth` creates both rows atomically and returns both entities
- [x] T-012: `CreateUserWithAuthRepository.createUserWithAuth` rejects with `P2002` on duplicate email, creating neither row
- [x] T-013: `RegisterUserUseCase.registerUser` creates and returns a `User` when the email doesn't exist (happy path — Decision Table row 2)
- [x] T-014: `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` when `existsByEmail` is `true`, without calling `CreateUserWithAuthRepository` (Decision Table row 1)
- [x] T-015: `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` on a `P2002` race (Decision Table row 3)

## Phase 3: Polish

- [x] T-016: `toUserType` maps `id`/`email`/`name` and exposes no password/hash field
- [x] T-017: `registerUser` mutation happy path: returns `{ id, email, name }`, no `errors`
- [x] T-018: `registerUser` mutation duplicate email: `errors[0].extensions.code === 'CONFLICT'`
- [x] T-019: `registerUser` mutation invalid input (bad email / weak password / missing name): `errors[0].extensions.code === 'BAD_USER_INPUT'` with field-level `validationErrors`
