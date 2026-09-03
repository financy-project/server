# CORS - PM-008

## Description

Today the server boots via `startStandaloneServer` (`src/server.ts`), which
spins up its own internal Express instance with the `cors` package's
permissive default (`Access-Control-Allow-Origin: *`, no credentials). That
default is incompatible with how auth actually works here: `createContext`
(`src/context/create-context.ts`) reads the access token from an `httpOnly`
cookie, not an `Authorization` header. Browsers refuse to send/receive
credentialed cookies to a wildcard origin, so as soon as the client
(`financy-project/client`, a separate origin from the API) is deployed
somewhere that isn't the exact same origin, login and every authenticated
query/mutation will silently fail cross-origin — cookie never leaves the
browser.

This feature replaces the implicit default with an explicit, environment-aware
CORS policy: swap `startStandaloneServer` for `expressMiddleware`
(`@as-integrations/express5` — Apollo Server v5 no longer bundles a
`@apollo/server/express4` subpath the way v4 did; the Express integration is
now this separate package) + `express` + `cors`, restrict
`Access-Control-Allow-Origin` to a configured allowlist of client origins
(no wildcard, since credentials are required), and set
`Access-Control-Allow-Credentials: true` so the `httpOnly` cookie can round-trip
in dev, integration/e2e test runs, and production.

## Users

- **Financy client (browser SPA)** — needs its origin allowed and credentials
  enabled so cookie-based login/session survive cross-origin requests to this
  GraphQL API.
- **Backend engineers** — need a single, environment-driven place
  (`ALLOWED_ORIGINS` env var, validated in `src/config/environments.ts`) to add
  or change allowed client origins per environment, instead of hardcoding
  origins in server bootstrap code.

## Acceptance Criteria

- [ ] A new `ALLOWED_ORIGINS` env var (comma-separated list of origins) is
      added to `src/config/environments.ts` (Zod-validated, uppercase env var
      name per `CLAUDE.md` conventions) and to `.env.example` /
      `.env.dev` / `.env.integration` / `.env.e2e`.
- [ ] `src/server.ts` no longer uses `@apollo/server/standalone`; it uses
      `expressMiddleware` from `@as-integrations/express5` mounted on an
      `express` app, with the `cors` middleware configured from
      `Environments.allowedOrigins`.
- [ ] Requests from an origin in the allowlist receive
      `Access-Control-Allow-Origin: <that origin>` (reflected, not `*`) and
      `Access-Control-Allow-Credentials: true`.
- [ ] Requests from an origin **not** in the allowlist are rejected by the
      CORS layer (no `Access-Control-Allow-Origin` header on the response;
      the browser blocks the response from being read).
- [ ] Preflight `OPTIONS` requests are handled correctly for GraphQL POST
      requests carrying `content-type: application/json` and cookies.
- [ ] `httpOnly` auth cookie continues to be set/read correctly through the
      new Express-based transport (no regression in `createContext`'s
      `req.headers['cookie']` parsing or `res.setHeader('Set-Cookie', ...)`).
- [ ] Existing e2e tests (`pnpm test:e2e`) continue to pass against the new
      Express-based server wiring — the switch from `startStandaloneServer` to
      `expressMiddleware` must not change any resolver/use-case behavior.
- [ ] New e2e/integration coverage exercises: allowed origin succeeds,
      disallowed origin is blocked, credentials flag is present on allowed
      responses.
- [ ] `docker-compose.dev.yml` / local dev docs (if any mention the client
      URL) stay consistent with whatever origin the client actually runs on
      (e.g. `http://localhost:5173` for a Vite dev server — confirm actual
      port with the client project).

## Out of Scope

- Changing the auth mechanism itself (still `httpOnly` cookie + JWT via
  `JwtService`/`ACCESS_TOKEN_COOKIE_NAME`) — this feature only makes that
  mechanism work cross-origin.
- `SameSite`/`Secure` cookie attribute tuning for production HTTPS deployment
  topology (same-site vs. cross-site subdomains) — flag as a follow-up if the
  production domain layout isn't finalized yet.
- Rate limiting, CSRF protection, or other transport-security hardening beyond
  CORS itself.
- Any change to `GRAPHQL_COMPLEXITY_LIMIT` / `GRAPHQL_DEPTH_LIMIT` or other
  existing operational safeguards.
