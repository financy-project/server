# CORS - PM-008 - Phase 1: Foundation - Test Cases

- [x] T-001: `buildExpressApp` — allowed origin on `POST /graphql`: `access-control-allow-origin` equals the request's `Origin`, `access-control-allow-credentials` is `"true"`
- [x] T-002: `buildExpressApp` — disallowed origin on `POST /graphql`: no `access-control-allow-origin` header on the response
- [x] T-003: `buildExpressApp` — preflight `OPTIONS /graphql` from an allowed origin with `Access-Control-Request-Method: POST`: `204` status, `access-control-allow-methods` includes `POST`
- [x] T-004: `Environments.allowedOrigins` — `ALLOWED_ORIGINS` unset/empty parses to `[]`; a comma-separated value parses to a trimmed, non-empty array
