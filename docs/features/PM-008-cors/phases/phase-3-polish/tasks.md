# CORS - PM-008 - Phase 3: Polish - Tasks

- [x] B-009: Run `pnpm test:e2e` unmodified and confirm it's still green — this is the regression check that `buildApolloServer` (used directly by every e2e test) was not altered by this feature.
- [ ] B-010: Run `pnpm build` and confirm it compiles clean with the new `express`/`cors`/`@as-integrations/express5` types in place.
- [ ] B-011: Update `README.md` (if it documents how to start the server / hit the API locally) to mention `ALLOWED_ORIGINS` must be set for a browser-based client to work.
