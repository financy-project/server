# CORS - PM-008 - Implementation Plan

## Definition of Ready (DoR) Blueprints

This is an infrastructure/transport feature — it changes how the HTTP layer in
front of Apollo Server is wired, not any domain module. None of the DDD
layers in [docs/architecture/11-dor.md](../../architecture/11-dor.md) apply in
their usual sense; each is explicitly omitted below, and the actual design
surface is captured in the **Transport Blueprint** instead.

### Entity Blueprint

**Omitted:** No new domain concept is introduced. CORS is a transport-layer
policy (HTTP response headers), not a business object.

### Repository Blueprint

**Omitted:** No new data access. No table, no Prisma model, no query.

### Use-Case Blueprint

**Omitted:** No orchestration/business logic. There is nothing to branch on
inside application code — the `cors` npm package itself decides
allow/reject by comparing the request's `Origin` header against the
allowlist array we hand it; our code never inspects that decision.

### GraphQL Blueprint

**Omitted:** No schema change. No new `@ObjectType()`/`@InputType()`,
no new `@Query`/`@Mutation`/`@FieldResolver`, no new field on any existing
type. `schema.graphql` is unaffected and does **not** need regenerating.
The GraphQL schema itself is transport-agnostic — swapping the HTTP
transport underneath it (`startStandaloneServer` → `express` +
`expressMiddleware`) changes zero types, resolvers, or `schema.graphql`
output.

### Domain Events Blueprint

**Omitted:** No use-case emits or consumes an event here.

### Transport Blueprint

This is the actual design surface for this feature.

**Problem today:** `src/server.ts` calls
`startStandaloneServer(server, { context: createContext, listen: { port } })`.
`startStandaloneServer` builds its own internal `express` app and mounts the
`cors` npm package with its bare default options — `Access-Control-Allow-Origin: *`,
`Access-Control-Allow-Credentials` unset. Auth (`src/context/create-context.ts`)
reads the access token from an `httpOnly` cookie (`ACCESS_TOKEN_COOKIE_NAME`,
`req.headers['cookie']`), not an `Authorization` header. A wildcard origin can
never be paired with credentialed requests per the Fetch/CORS spec — browsers
refuse to expose the response (and won't send the cookie in the first place)
whenever `Access-Control-Allow-Origin: *` is present alongside
`credentials: 'include'` client-side. So today, any client on a different
origin than the API is silently broken for every authenticated operation.

**New dependencies** (`package.json`):

- `express` (^5) — dependencies
- `cors` (^2) — dependencies
- `@as-integrations/express5` — dependencies (Apollo Server v5's Express
  integration; confirmed via the installed `@apollo/server@5.5.1` package's
  `exports` map that it has **no** `./express4` subpath — that only existed
  on Apollo Server v4. v5 moved framework integrations to separate
  `@as-integrations/*` packages.)
- `@types/express`, `@types/cors` — devDependencies
- `supertest`, `@types/supertest` — devDependencies (HTTP-level test target
  decided in grill-me: CORS is response-header behavior at the HTTP layer;
  `buildApolloServer().executeOperation()`, which every existing e2e test
  uses, calls resolvers directly in-process and never goes through Express
  or the `cors` middleware, so it cannot exercise this feature)

**New/changed symbols:**

- `src/config/environments.ts` — add:

  ```ts
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ```

  parsed into `env.ALLOWED_ORIGINS` (typed `string[]`), plus the parse-call
  entry `ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS']` and a new getter:

  ```ts
  get allowedOrigins(): string[] {
    return env.ALLOWED_ORIGINS
  },
  ```

  Defaulting to `''` → `[]` (empty allowlist, blocks everything) means every
  environment that doesn't set the var — including the plain `pnpm test`
  unit-test run via `.env.test` — keeps working exactly as today, no
  behavior change unless the var is explicitly set.

- `src/app.ts` — add a new exported function alongside the existing
  `buildApolloServer` (this file is already documented in `CLAUDE.md` as
  owning "Apollo Server instance setup" — the Express wiring around it
  belongs next to it, not in a new top-level directory that doesn't exist
  in the documented file layout):

  ```ts
  export const buildExpressApp = async (
    server: ApolloServer<GraphQLContext>,
    allowedOrigins: readonly string[],
  ): Promise<Express> => {
    await server.start()

    const app = express()
    app.use(
      '/graphql',
      cors({ origin: allowedOrigins, credentials: true }),
      express.json(),
      expressMiddleware(server, { context: createContext }),
    )

    return app
  }
  ```

  `allowedOrigins` is a parameter, not read from `Environments` internally —
  this keeps `buildExpressApp` a pure function of its inputs, so tests can
  pass a fixed, small allowlist without touching `process.env`/module-level
  state. `buildApolloServer` itself is untouched — every existing e2e test
  that imports and calls it directly keeps working unmodified.

- `src/server.ts` — replace the `startStandaloneServer` call:

  ```ts
  const server = await buildApolloServer()
  const app = await buildExpressApp(server, Environments.allowedOrigins)

  app.listen(Environments.port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${Environments.port}/graphql`,
    )
  })
  ```

- `.env.example` / `.env.dev` / `.env.integration` / `.env.e2e` — add:
  ```
  ALLOWED_ORIGINS=http://localhost:5173
  ```
  (Vite's default dev port — per grill-me, only the local-dev origin is
  known right now; production's origin is not yet decided and is explicitly
  flagged as a deployment-time follow-up below, not something this repo's
  `.env.*` files can encode today.) `.env.test` is intentionally left
  without the var — the plain `pnpm test` unit suite never exercises HTTP
  transport, so the `[]` default is correct there.

**Testing target:** `src/__tests__/unit/build-express-app-cors-describe.test.ts`
(new top-level `src/__tests__/unit/` dir, mirroring the existing
`src/context/__tests__/unit/` and `src/plugins/__tests__/unit/` pattern for
files that live directly under `src/`, not inside a module) — built with
`supertest(app)`, calling `buildExpressApp(await buildApolloServer(), ['http://allowed.test'])`
directly. No Docker, no database: `cors` sets its headers before the request
ever reaches `expressMiddleware`/any resolver, so this is genuinely a unit
test of the middleware wiring, not an integration test against a real schema
resolution. It is intentionally **not** placed under `integration/repository`
or `integration/e2e` — those npm-script path patterns are reserved for
Docker-backed suites, and this test needs neither.

## Architectural Decisions

- **Scope & Requirements:** Make the GraphQL API usable from a
  browser-based client on a different origin, given cookie-based auth.
  Success = an allowed origin gets `Access-Control-Allow-Origin: <origin>` +
  `Access-Control-Allow-Credentials: true`; any other origin gets neither.
  Out of scope: changing the auth mechanism, `SameSite`/`Secure` cookie
  tuning for the eventual production topology, CSRF/rate limiting. No
  backward-compatibility constraint — there is no shipped client depending
  on today's wildcard-CORS behavior yet.
- **Data & State:** Not Applicable — no persisted entity, no migration.
- **User Experience:** Happy path — allowed-origin browser request completes
  normally with the cookie attached both ways. Failure path — a
  disallowed-origin request has **no GraphQL-level `extensions.code`**: the
  server still executes and responds (or fails on its own merits), but the
  `cors` middleware never adds `Access-Control-Allow-Origin`, so the
  _browser_ refuses to expose the response body to the calling page (a
  `TypeError: Failed to fetch` / console CORS error on the client, not
  anything visible in the GraphQL response itself). This is worth stating
  explicitly since it's the one failure mode in this codebase with no
  `extensions.code` to assert on — the assertion in tests has to be "response
  is missing `Access-Control-Allow-Origin`", not "GraphQL returned error X".
- **Testing & Validation:** New `supertest`-based unit suite (see Transport
  Blueprint) covering: allowed origin → header present + `credentials:true`;
  disallowed origin → header absent; preflight `OPTIONS` on `/graphql`
  handled (204, correct `Access-Control-Allow-Methods`/`-Headers`). Existing
  `pnpm test:e2e` suite re-run as regression check — it calls
  `buildApolloServer()` directly and is expected to need zero changes, since
  `buildApolloServer` isn't touched.
- **Implementation Details:** Touches `src/app.ts`, `src/server.ts`,
  `src/config/environments.ts`, `.env.*`, `package.json` only — no
  `src/modules/*` module is touched, so module-isolation rules don't come
  into play. New deps: `express`, `cors`, `@as-integrations/express5` (+
  `@types/*`, `supertest` dev-only). No relational field added → no
  DataLoader. No list-returning/deeply-nested GraphQL field added → no
  `complexity` cost to declare. `schema.graphql` regeneration: **not
  needed**, schema is unchanged.
- **Security Considerations:** Auth mechanism itself (JWT in an `httpOnly`
  cookie, `JwtService`) is unchanged. The allowlist is the only thing
  standing between "any site can read a logged-in user's data" and "only
  the real client can" once credentials are enabled — so `origin: '*'` with
  `credentials: true` must never be reachable; the `cors` package itself
  throws away that combination since it only ever reflects a _specific_
  matched origin, never `*`, when a static array is passed as `origin`. No
  new timing-sensitive comparison is introduced. No rate limiting added —
  out of scope per spec.
- **Complex Workflows:** Not Applicable — single synchronous middleware
  configuration, no multi-step/async process.
- **Cross-Cutting Concerns:** Per grill-me: no additional logging for
  blocked origins in this PR (default silent `cors` behavior). No caching.
  No new metrics/tracing — out of scope for this feature's size.
- **Error Scenarios & Failure Modes:** Database-down, external-service-down,
  and race-condition scenarios are all irrelevant here — the `cors`
  middleware runs before any resolver, use-case, or Prisma call, so none of
  those failure modes intersect with this feature. There is no retry/backoff
  concern — CORS header computation is synchronous and side-effect-free.
- **Performance & Scale:** Not Applicable — `cors` middleware overhead per
  request is negligible (string comparisons against a short array); no
  throughput/latency requirement beyond "don't add a measurable regression,"
  which this doesn't.
- **Module Composition:** Not Applicable — nothing here lives inside
  `src/modules/*`; there's no module boundary to cross or violate.
- **Deployment & Operations:** No DB migration. Rollback = revert the commit
  / redeploy the previous `ALLOWED_ORIGINS` value — this is a stateless
  config change. **Follow-up flagged, not solved here:** the production
  client origin isn't decided yet, so whatever hosting platform runs this in
  production will need `ALLOWED_ORIGINS` set as a deploy-time env var before
  go-live; this repo's `.env.*` files only cover local dev/integration/e2e.
  No feature flag — this is an infra correction, not a gradual rollout
  candidate. No new monitoring beyond what already exists.
- **Backward Compatibility:** Not Applicable — no schema change, so no
  existing client query is affected. The transport swap
  (`startStandaloneServer` → `express` + `expressMiddleware`) is an
  internal implementation detail invisible to any GraphQL client; the
  `/graphql` path, request/response shape, and error format are unchanged.

## Implementation Phases

### Phase 1: Foundation

- [ ] Add `express` (^5), `cors` (^2), `@as-integrations/express5` to
      `dependencies`, and `@types/express`, `@types/cors`, `supertest`,
      `@types/supertest` to `devDependencies` in `package.json`.
- [ ] Add `ALLOWED_ORIGINS` to `src/config/environments.ts`: schema entry
      `ALLOWED_ORIGINS: z.string().default('').transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))`,
      the matching `env.parse(...)` call entry
      `ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS']`, and getter
      `get allowedOrigins(): string[] { return env.ALLOWED_ORIGINS }`.
- [ ] Add `ALLOWED_ORIGINS=http://localhost:5173` to `.env.example`,
      `.env.dev`, `.env.integration`, `.env.e2e`. Leave `.env.test` unset
      (defaults to `[]`).
- [ ] Implement `buildExpressApp` in `src/app.ts`:
      `export const buildExpressApp = async (server: ApolloServer<GraphQLContext>, allowedOrigins: readonly string[]): Promise<Express>` —
      calls `await server.start()`, creates an `express()` app, mounts on
      `/graphql`: `cors({ origin: allowedOrigins, credentials: true })`,
      `express.json()`, `expressMiddleware(server, { context: createContext })`
      (from `@as-integrations/express5`), returns the app. `buildApolloServer`
      is not modified.
- [ ] Unit tests for `buildExpressApp`
      (`src/__tests__/unit/build-express-app-cors-describe.test.ts`, using
      `supertest`): allowed origin on a `POST /graphql` request receives
      `access-control-allow-origin: <that exact origin>` and
      `access-control-allow-credentials: true`; disallowed origin on the same
      request receives neither header; preflight `OPTIONS /graphql` with
      `Access-Control-Request-Method: POST` from an allowed origin resolves
      `204` with `access-control-allow-methods` including `POST`.

### Phase 2: Features

- [ ] Update `src/server.ts`: remove the `@apollo/server/standalone` import
      and `startStandaloneServer` call; call
      `const app = await buildExpressApp(server, Environments.allowedOrigins)`
      then `app.listen(Environments.port, () => console.log(...))`.
- [ ] Manual verification (documented in the PR description, not automated):
      run `pnpm dev`, hit `POST http://localhost:<port>/graphql` with
      `curl -H "Origin: http://localhost:5173"` and confirm
      `access-control-allow-origin`/`-credentials` headers appear; repeat
      with a bogus `Origin` and confirm they don't.
- [ ] Confirm the existing `httpOnly` cookie flow is unaffected: no code
      change is expected in `src/context/create-context.ts` (Express's
      `req`/`res` are structurally compatible with the `IncomingMessage`/
      `ServerResponse` types `createContext` already expects) — this is a
      verification item, not an implementation item.

### Phase 3: Polish

- [ ] Run `pnpm test:e2e` unmodified and confirm it's still green — this is
      the regression check that `buildApolloServer` (used directly by every
      e2e test) was not altered by this feature.
- [ ] Run `pnpm build` and confirm it compiles clean with the new
      `express`/`cors`/`@as-integrations/express5` types in place.
- [ ] Update `README.md` (if it documents how to start the server / hit the
      API locally) to mention `ALLOWED_ORIGINS` must be set for a
      browser-based client to work.

## Test Cases

### Phase 1: Foundation

- [ ] `buildExpressApp` — allowed origin on `POST /graphql`:
      `access-control-allow-origin` equals the request's `Origin`,
      `access-control-allow-credentials` is `"true"`
- [ ] `buildExpressApp` — disallowed origin on `POST /graphql`: no
      `access-control-allow-origin` header on the response
- [ ] `buildExpressApp` — preflight `OPTIONS /graphql` from an allowed
      origin with `Access-Control-Request-Method: POST`: `204` status,
      `access-control-allow-methods` includes `POST`
- [ ] `Environments.allowedOrigins` — `ALLOWED_ORIGINS` unset/empty parses
      to `[]`; a comma-separated value parses to a trimmed, non-empty array

### Phase 2: Features

- [ ] Manual verification only (see Implementation Phases) — no new
      automated test in this phase; covered by Phase 1's `buildExpressApp`
      suite plus Phase 3's e2e regression run.

### Phase 3: Polish

- [ ] `pnpm test:e2e` passes unmodified (regression, not a new test case)

## Dependencies

- External packages: `express` (^5), `cors` (^2), `@as-integrations/express5`
  (runtime); `@types/express`, `@types/cors`, `supertest`, `@types/supertest`
  (dev)
- Internal: none — no `src/modules/*` module is touched or depended on

## Risks & Mitigations

| Risk                                                                                                                                                                              | Impact                               | Mitigation                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swapping `startStandaloneServer` for manual `express` wiring breaks something `startStandaloneServer` handled implicitly (body parsing, `server.start()` lifecycle, landing page) | Medium                               | `pnpm test:e2e` regression run (Phase 3) + manual `curl` verification (Phase 2) before merge; `express.json()` and `server.start()` are called explicitly to replace what `startStandaloneServer` did automatically |
| Production client origin isn't decided yet, so `ALLOWED_ORIGINS` can't be finalized for that environment                                                                          | Low (dev/integration/e2e work today) | Explicitly flagged in Deployment & Operations above as a required deploy-time follow-up, not silently deferred                                                                                                      |
| `@as-integrations/express5` (third-party, not Apollo-maintained) has a breaking change or is abandoned                                                                            | Low                                  | It's the community package Apollo's own docs point to for Express 5 + Apollo Server v5; pin an exact version like every other dependency in this repo                                                               |

## Success Criteria

- [ ] All acceptance criteria in `spec.md` met
- [ ] `buildExpressApp` unit tests passing
- [ ] `pnpm test:e2e` passes unmodified (regression)
- [ ] `pnpm build` compiles without errors
- [ ] `schema.graphql` unchanged (no regeneration needed, confirmed by `git diff` showing no change to it)
