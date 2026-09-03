# CORS - PM-008 - Test Cases

Generated from `plan.md`'s `## Test Cases` — each entry copied verbatim, prefixed with a `T-NNN` id.

## Phase 1: Foundation

- [ ] T-001: `buildExpressApp` — allowed origin on `POST /graphql`: `access-control-allow-origin` equals the request's `Origin`, `access-control-allow-credentials` is `"true"`
- [ ] T-002: `buildExpressApp` — disallowed origin on `POST /graphql`: no `access-control-allow-origin` header on the response
- [ ] T-003: `buildExpressApp` — preflight `OPTIONS /graphql` from an allowed origin with `Access-Control-Request-Method: POST`: `204` status, `access-control-allow-methods` includes `POST`
- [x] T-004: `Environments.allowedOrigins` — `ALLOWED_ORIGINS` unset/empty parses to `[]`; a comma-separated value parses to a trimmed, non-empty array

## Phase 2: Features

- [ ] T-005: Manual verification only (see Implementation Phases) — no new automated test in this phase; covered by Phase 1's `buildExpressApp` suite plus Phase 3's e2e regression run.

## Phase 3: Polish

- [ ] T-006: `pnpm test:e2e` passes unmodified (regression, not a new test case)
