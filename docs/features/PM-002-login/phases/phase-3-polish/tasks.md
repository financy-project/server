## Phase 3: Polish

- [ ] B-026: Regenerate `schema.graphql` (`pnpm build` or dev server run triggers `emitSchemaFile`) and commit the diff (new `login` mutation, new `LoginInput` type)
- [ ] B-027: Review that `console.error`/logging paths never log `input.password` or the issued `token` (spot-check `LoginUseCase`, `AuthResolver`, `formatError`)
- [ ] B-028: Confirm `pnpm build` compiles cleanly with the new `jsonwebtoken` dependency and updated `GraphQLContext` shape
