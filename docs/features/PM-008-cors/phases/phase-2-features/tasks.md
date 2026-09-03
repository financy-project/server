# CORS - PM-008 - Phase 2: Features - Tasks

- [x] B-006: Update `src/server.ts`: remove the `@apollo/server/standalone` import and `startStandaloneServer` call; call `const app = await buildExpressApp(server, Environments.allowedOrigins)` then `app.listen(Environments.port, () => console.log(...))`.
- [x] B-007: Manual verification (documented in the PR description, not automated): run `pnpm dev`, hit `POST http://localhost:<port>/graphql` with `curl -H "Origin: http://localhost:5173"` and confirm `access-control-allow-origin`/`-credentials` headers appear; repeat with a bogus `Origin` and confirm they don't.
- [x] B-008: Confirm the existing `httpOnly` cookie flow is unaffected: no code change is expected in `src/context/create-context.ts` (Express's `req`/`res` are structurally compatible with the `IncomingMessage`/`ServerResponse` types `createContext` already expects) — this is a verification item, not an implementation item.
