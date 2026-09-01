# Transações - PM-004 - Phase 3: Polish - Tasks

- [ ] B-033: Security review: confirm no test or resolver path ever returns `extensions.code: 'FORBIDDEN'` for transaction/category ownership (must always be `NOT_FOUND`), and that no error message leaks another user's transaction/category data.
- [ ] B-034: Confirm `pnpm build`, `pnpm lint`, and the full `pnpm test` suite (unit + integration + e2e) pass.
- [ ] B-035: Update `docs/features/PM-004-transacoes/spec.md` acceptance criteria checkboxes to `[x]` as each is verified against the running e2e suite.
