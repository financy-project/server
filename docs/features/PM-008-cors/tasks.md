# CORS - PM-008 - Tasks

Generated from `plan.md`'s `## Implementation Phases` — each bullet copied verbatim, prefixed with a `B-NNN` id.

## Phase 1: Foundation

- [ ] B-001: Add `express` (^5), `cors` (^2), `@as-integrations/express5` to `dependencies`, and `@types/express`, `@types/cors`, `supertest`, `@types/supertest` to `devDependencies` in `package.json`.
- [ ] B-002: Add `ALLOWED_ORIGINS` to `src/config/environments.ts`: schema entry `ALLOWED_ORIGINS: z.string().default('').transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))`, the matching `env.parse(...)` call entry `ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS']`, and getter `get allowedOrigins(): string[] { return env.ALLOWED_ORIGINS }`.
- [ ] B-003: Add `ALLOWED_ORIGINS=http://localhost:5173` to `.env.example`, `.env.dev`, `.env.integration`, `.env.e2e`. Leave `.env.test` unset (defaults to `[]`).
- [ ] B-004: Implement `buildExpressApp` in `src/app.ts`: `export const buildExpressApp = async (server: ApolloServer<GraphQLContext>, allowedOrigins: readonly string[]): Promise<Express>` — calls `await server.start()`, creates an `express()` app, mounts on `/graphql`: `cors({ origin: allowedOrigins, credentials: true })`, `express.json()`, `expressMiddleware(server, { context: createContext })` (from `@as-integrations/express5`), returns the app. `buildApolloServer` is not modified.
- [ ] B-005: Unit tests for `buildExpressApp` (`src/__tests__/unit/build-express-app-cors-describe.test.ts`, using `supertest`): allowed origin on a `POST /graphql` request receives `access-control-allow-origin: <that exact origin>` and `access-control-allow-credentials: true`; disallowed origin on the same request receives neither header; preflight `OPTIONS /graphql` with `Access-Control-Request-Method: POST` from an allowed origin resolves `204` with `access-control-allow-methods` including `POST`.

## Phase 2: Features

- [ ] B-006: Update `src/server.ts`: remove the `@apollo/server/standalone` import and `startStandaloneServer` call; call `const app = await buildExpressApp(server, Environments.allowedOrigins)` then `app.listen(Environments.port, () => console.log(...))`.
- [ ] B-007: Manual verification (documented in the PR description, not automated): run `pnpm dev`, hit `POST http://localhost:<port>/graphql` with `curl -H "Origin: http://localhost:5173"` and confirm `access-control-allow-origin`/`-credentials` headers appear; repeat with a bogus `Origin` and confirm they don't.
- [ ] B-008: Confirm the existing `httpOnly` cookie flow is unaffected: no code change is expected in `src/context/create-context.ts` (Express's `req`/`res` are structurally compatible with the `IncomingMessage`/`ServerResponse` types `createContext` already expects) — this is a verification item, not an implementation item.

## Phase 3: Polish

- [ ] B-009: Run `pnpm test:e2e` unmodified and confirm it's still green — this is the regression check that `buildApolloServer` (used directly by every e2e test) was not altered by this feature.
- [ ] B-010: Run `pnpm build` and confirm it compiles clean with the new `express`/`cors`/`@as-integrations/express5` types in place.
- [ ] B-011: Update `README.md` (if it documents how to start the server / hit the API locally) to mention `ALLOWED_ORIGINS` must be set for a browser-based client to work.
