# Categorias - PM-003 - Phase 3: Polish - Tasks

- [ ] B-023: Security review: confirm no test or resolver path ever returns `extensions.code: 'FORBIDDEN'` for category ownership (must always be `NOT_FOUND`, per the Architectural Decisions above) and that no error message leaks another user's `title`/`description` value.
- [ ] B-024: Confirm `pnpm build`, `pnpm lint`, and the full `pnpm test` suite (unit + integration + e2e) pass.
- [ ] B-025: Update `docs/features/PM-003-categorias/spec.md` acceptance criteria checkboxes to `[x]` as each is verified against the running e2e suite.
