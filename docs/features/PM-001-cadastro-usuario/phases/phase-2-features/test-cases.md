## Phase 2: Features

- [ ] T-005: `RegisterUserValidation.validate` passes through valid input unchanged
- [ ] T-006: `RegisterUserValidation.validate` throws `ValidationError` for invalid email
- [ ] T-007: `RegisterUserValidation.validate` throws `ValidationError` for a password missing an uppercase letter, missing a number, or under 8 characters
- [ ] T-008: `RegisterUserValidation.validate` throws `ValidationError` for an empty/missing name
- [ ] T-009: `UserRepository.existsByEmail` returns `true` for an existing email
- [ ] T-010: `UserRepository.existsByEmail` returns `false` for a non-existent email
- [ ] T-011: `CreateUserWithAuthRepository.createUserWithAuth` creates both rows atomically and returns both entities
- [ ] T-012: `CreateUserWithAuthRepository.createUserWithAuth` rejects with `P2002` on duplicate email, creating neither row
- [ ] T-013: `RegisterUserUseCase.registerUser` creates and returns a `User` when the email doesn't exist (happy path — Decision Table row 2)
- [ ] T-014: `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` when `existsByEmail` is `true`, without calling `CreateUserWithAuthRepository` (Decision Table row 1)
- [ ] T-015: `RegisterUserUseCase.registerUser` throws `UserAlreadyExistsError` on a `P2002` race (Decision Table row 3)

