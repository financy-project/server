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
