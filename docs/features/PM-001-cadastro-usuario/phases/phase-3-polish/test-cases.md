## Phase 3: Polish

- [x] T-016: `toUserType` maps `id`/`email`/`name` and exposes no password/hash field
- [x] T-017: `registerUser` mutation happy path: returns `{ id, email, name }`, no `errors`
- [x] T-018: `registerUser` mutation duplicate email: `errors[0].extensions.code === 'CONFLICT'`
- [x] T-019: `registerUser` mutation invalid input (bad email / weak password / missing name): `errors[0].extensions.code === 'BAD_USER_INPUT'` with field-level `validationErrors`
