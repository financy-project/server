# CLAUDE.md

This file provides operational guidance for working with this repository. For architectural principles and development philosophy, see **[constitution.md](constitution.md)**.

> This project is bootstrapped from the same architecture/workflow as a sibling REST project, adapted for **GraphQL + Apollo Server + TypeGraphQL + Prisma**. `docs/architecture/`, `constitution.md`, the `.claude/agents/`, and the `.claude/skills/` are all written and current. What's still missing is the actual application scaffolding — `package.json`, `tsconfig*.json`, `prisma/schema.prisma`, `.env.*`, and the `src/` skeleton itself.

## Commands

```bash
# Development
pnpm dev                # Start dev server with auto-reload (Apollo Server + GraphQL Playground/Sandbox)

# Building
pnpm build              # Compile TypeScript to dist/ (tsc -p tsconfig.build.json)

# Testing
pnpm test               # Run Jest tests
pnpm test:watch         # Run Jest in watch mode
# Run a single test file
pnpm test --testPathPatterns=health.use-case
# Run only integration tests
pnpm test --testPathPatterns=integration
# Run only e2e tests
pnpm test --testPathPatterns=e2e
```

### Database (Docker Compose)

Three isolated environments, matching `docker-compose.dev.yml` / `docker-compose.integration.yml` / `docker-compose.e2e.yml`. **You don't need to start these manually** — `pnpm dev`, `pnpm test:integration`, and `pnpm test:e2e` each run a `pre*` script (`predev`, `pretest:integration`, `pretest:e2e`) that brings up their container automatically via `docker compose up -d --wait`, blocking until Postgres reports healthy before the actual command runs. This is pnpm's standard pre/post script convention — no extra tooling involved.

```bash
# Manual control, if you want it — idempotent, safe to run anytime:
pnpm docker:dev              # Local development — persistent named volume (data survives restarts)
pnpm docker:integration       # Integration tests — tmpfs (volatile, wiped on container stop)
pnpm docker:e2e               # E2E tests — tmpfs (volatile, wiped on container stop)

# Tear down when you want a truly clean slate (dev's volume is removed with the container):
pnpm docker:dev:down
pnpm docker:integration:down
pnpm docker:e2e:down
```

Each environment has its own container name, port, and database name (see the compose files) so all three can run simultaneously without colliding.

### Prisma

```bash
pnpm prisma:generate                        # Generate Prisma Client after schema changes
pnpm prisma:migrate:dev                     # Create and apply a new migration (dev database)
pnpm prisma:migrate:deploy:integration       # Apply existing migrations (integration — never generates new ones)
pnpm prisma:migrate:deploy:e2e               # Apply existing migrations (e2e — never generates new ones)
pnpm prisma:studio                          # Open Prisma Studio against the dev database
```

## Writing Tests

### Repository Tests (Integration)

Repository tests **must use a real database**, not mocks. Place tests in `__tests__/integration/repository/`:

```ts
import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { UserRepository } from '../../repository'

describe('UserRepository (integration)', () => {
  useDatabase()

  describe('findByEmail', () => {
    it('returns a User when found', async () => {
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          statusId: 'ACTIVE',
        },
      })

      const result = await UserRepository.findByEmail('test@example.com')

      expect(result.email).toBe('test@example.com')
    })
  })
})
```

**Key points:**

- Use `useDatabase()` helper to set up the test database (runs against `docker-compose.integration.yml`)
- Create/modify data directly with Prisma in the test
- No mocking — test against the real database
- Clean-up happens automatically via `useDatabase()`

### E2E Tests (Full GraphQL Stack)

E2E tests execute **real GraphQL documents** against the built schema — no mocks, no calling resolver methods directly:

```ts
import { buildTestSchema } from '@/test/helpers/schema'
import { useDatabase } from '@/test/helpers/db'

describe('registerUser mutation (e2e)', () => {
  useDatabase()

  it('creates a user and returns it', async () => {
    const server = await buildTestSchema()

    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id email name }
        }
      `,
      variables: {
        input: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'supersecret',
        },
      },
    })

    expect(response.body.kind).toBe('single')
    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['registerUser']).toMatchObject({
      email: 'test@example.com',
    })
  })
})
```

**Key points:**

- Assert on `data` / `errors[].extensions.code` — the actual wire shape a client would see
- Runs against `docker-compose.e2e.yml` (isolated, volatile database)

## For Backend-Engineer Agents

When implementing backend features, follow this layer-by-layer order (see [docs/architecture/13-backend-development-checklist.md](docs/architecture/13-backend-development-checklist.md)):

1. **Types & Enums** — define contracts first
2. **Entity** — write failing entity tests, then implement (no decorators, no GraphQL awareness)
3. **Errors** — create domain-specific error classes
4. **GraphQL Input/Args Types & Validation** — `@InputType()`/`@ArgsType()` classes with `class-validator` decorators, with tests
5. **Repository** — data access with integration tests
6. **Use-Case** — business logic with unit tests (mocked), returns entities only
7. **GraphQL Object Type & Mapper** — `@ObjectType()` schema shape + pure `entity → type` mapper function
8. **Resolver** — binds Query/Mutation/FieldResolver, validates input, delegates to use-case, maps output
9. **Loaders** (if the module exposes relational fields) — `DataLoader` factory, instantiated per-request
10. **Barrel Exports** — clean public API
11. **i18n** — all user-facing text (error messages, validation messages)

**Critical points:**

- Enums go in `enums/` with SCREAMING_SNAKE_CASE keys (not in `types/`)
- Constants go in `src/utils/constants/` with barrel exports
- Test files: one describe block per file (split if multiple)
- Security: timing-safe login (never short-circuit on user-not-found)
- Gateways call adapters internally (never as parameters)
- Adapter ownership: "adapter lives where the data is"
- **Resolvers never return entities directly** — always through the module's mapper
- **Any relational `@FieldResolver` must use a `DataLoader`** — never call the repository directly (N+1 risk)
- Domain errors bubble up unmodified from use-cases; a single Apollo `formatError` translates them — resolvers never catch/reformat errors themselves

See **[constitution.md](constitution.md)** for the full pattern with code examples.

## Configuration & Best Practices

### Environment Variables

Always use **bracket notation** for safe environment variable access:

```typescript
// ✅ Good - bracket notation (TypeScript noUncheckedIndexedAccess safe)
const dbUrl = process.env['DATABASE_URL']
const nodeEnv = process.env['NODE_ENV']

// ❌ Avoid - dot notation (can fail TS strict checks)
const dbUrl = process.env.DATABASE_URL
```

Use **uppercase with underscores** for all env var names: `DATABASE_URL`, `NODE_ENV`, `API_KEY`.

Each environment has its own env file: `.env.dev`, `.env.integration`, `.env.e2e`, `.env.example` — pointing at the matching Docker Compose Postgres instance/port.

### Logging in Tests

Verbose request/schema-build logging must be disabled during test runs to keep output clean — gate any logging plugin behind `process.env['NODE_ENV'] !== 'test'` the same way the Apollo Server instance itself is built per-environment.

## Architecture

### Principles & Philosophy

See **[constitution.md](constitution.md)** for architectural principles, patterns, and conventions:

- **Function-First DDD** — const objects of pure functions, with four explicit exceptions: entities, error classes, GraphQL type classes, and `@Resolver()` classes
- **Layered Architecture** — `resolver → use-case → entity/repository/service` (no separate router/controller)
- **Module Isolation** — modules are the only boundary, no direct imports between modules
- **Public API via Barrel Exports** — import from `modules/<name>` only
- **Entity ≠ GraphQL Type** — always two classes, connected by a pure mapper
- **Test Structure** — unit / integration / e2e tests with clear boundaries
- **Code Conventions** — file naming, style, max 200 lines per file
- **Cross-Module Communication** — domain events, or ports/adapters/gateways, not direct imports
- **GraphQL-Specific Concerns** — mandatory DataLoader for relations, query complexity/depth limits, request-scoped context, schema committed to the repo

### Practical Patterns & Implementation

Detailed implementation patterns with code examples live in [docs/architecture/](docs/architecture/README.md):

- **[01. Module Structure](docs/architecture/01-module-structure.md)** — Directory layout, naming conventions, barrel exports
- **[02. Entities](docs/architecture/02-entities.md)** — Private constructors, create() and fromRepository() factories
- **[03. Repository](docs/architecture/03-repository.md)** — Prisma internals, custom errors, function pattern
- **[04. Errors & i18n](docs/architecture/04-errors-and-i18n.md)** — Domain errors with i18n keys, Apollo error formatting
- **[05. Validation](docs/architecture/05-validation.md)** — `class-validator` on `@InputType()` classes
- **[06. GraphQL Types](docs/architecture/06-graphql-types.md)** — ObjectType/InputType/ArgsType conventions, mapper pattern
- **[07. Use-Cases & Resolvers](docs/architecture/07-use-cases-and-resolvers.md)** — Business logic orchestration, GraphQL binding
- **[08. Testing](docs/architecture/08-testing.md)** — Unit, integration, e2e patterns; one describe per file
- **[09. Configuration](docs/architecture/09-configuration.md)** — Environment variables with Zod, uppercase normalization
- **[10. Cross-Module Communication](docs/architecture/10-cross-module-communication.md)** — Events and Ports & Adapters patterns
- **[11. Definition of Ready (DoR)](docs/architecture/11-dor.md)** — Required blueprints for feature planning
- **[12. GraphQL Operational Concerns](docs/architecture/12-graphql-operational-concerns.md)** — DataLoader, query complexity, context, schema artifact policy
- **[13. Backend Development Checklist](docs/architecture/13-backend-development-checklist.md)** — Layer-by-layer implementation guide
- **[14. Feature Planning Checklist](docs/architecture/14-feature-planning-checklist.md)** — 13 planning areas for `plan.md`
- **[Checklist](docs/architecture/checklist.md)** — Pre-PR validation checklist for new modules

## Creating New Modules

Use the `/scaffold` skill (or the script it wraps) to create a new module structure automatically:

```bash
# Using the skill
/scaffold <module-name>

# Or directly with node (works even before package.json exists)
node scripts/scaffold-module.js <module-name>

# Or once package.json has the "scaffold" script
pnpm scaffold <module-name>
```

This creates the full directory structure with barrel files (`index.ts`) in each folder, mirroring [constitution.md](constitution.md#module-structure): `entity/`, `types/`, `enums/`, `errors/`, `graphql/{object-types,input-types,args}/`, `validation/`, `mappers/`, `repository/`, `use-cases/`, `resolvers/`, plus `__tests__/{unit,integration,factories}/`.

Then:

1. Implement files following the architecture patterns in `docs/architecture/`, in the order `/scaffold`'s output prints
2. Update barrel files (`index.ts`) as you add files
3. Register the resolver class in the schema builder (`src/schema/build-schema.ts`)
4. Write tests in `__tests__/{unit,integration}`
5. Validate with `/architecture-audit src/modules/<module-name>`

## PR Review & Corrections Workflow

When a PR has review comments or feedback to address:

1. **Read PR comments**: `gh pr view <PR#> --comments`
2. **Checkout the PR's branch** (NOT the base branch)
3. Implement all corrections **in that branch**
4. Commit changes with an explicit message: `git commit -m "..."`
5. If the branch is part of a stack, rebase dependent branches afterward

**Key rule:** Never implement PR fixes in the base branch. Keep changes isolated to the PR's branch to avoid merge conflicts when rebasing dependents.

## Spec Driven Development (SDD)

Features are driven by specifications, not tickets. All feature work must align with [constitution.md](constitution.md). Use the feature-* skills to plan and track work:

### Workflow

1. **`/feature-new "Feature Name"`** — Create a new feature with PM-NNN numbering
   - Numbers itself off the dedicated [financy-project/features](https://github.com/financy-project/features) repo's GitHub issues (or `docs/features/` locally if no remote/gh) — the PM-NNN sequence is shared across every project in the org
   - Creates `docs/features/PM-NNN-slug/` with `spec.md` and `plan.md` **in this repo**
   - Creates git branch `PM-NNN/slug`
   - Optionally creates a GitHub milestone + issue **in `financy-project/features`** with `--milestone "v1.0"`, linked back to this repo/branch/files

2. **Fill `spec.md`** — Write requirements and acceptance criteria (user story format), or use the `product-owner` agent to collaborate on it

3. **`/feature-plan`** — Plan the implementation (comprehensive coverage)
   - Reads `spec.md`
   - Reads `docs/architecture/14-feature-planning-checklist.md`
   - Invokes `/grill-me` to surface edge cases across all 13 planning areas, including the GraphQL-specific additions (complexity budget, DataLoader needs, schema breaking-change risk)
   - Writes `plan.md` with the [DoR Blueprints](docs/architecture/11-dor.md) (Entity, Repository, Use-Case, **GraphQL**, Domain Events) and the Architectural Decisions section

4. **`/feature-task`** — Break down the plan into tasks
   - Generates `tasks.md` (flat) + `test-cases.md`, sliced per-phase under `phases/phase-N-slug/`
   - Each task: `- [ ] B-NNN: Description`, organized by phase, following the layer order in [docs/architecture/13-backend-development-checklist.md](docs/architecture/13-backend-development-checklist.md)

5. **`/workflow [max_iterations]`** — Run the full iterative TDD implementation phase-by-phase, creating stacked branches and PRs autonomously (or implement manually, checking off tasks as `[x]`)

6. **`/feature-status`** — Track progress; **`/feature-list`** — see all features at a glance

### Key Points

- **Spec before code** — Never code without a written spec
- **Constitution alignment** — All plans and tasks must respect [constitution.md](constitution.md)
- **Planning is comprehensive** — Cover all applicable planning areas in `plan.md`, explicitly marking any as "Not Applicable" rather than omitting them silently
- **Tasks are granular** — Backend tasks cover every layer (entity, use-case, resolver, mapper, loader if relational) plus error handling, migrations, logging, monitoring
- **Dedicated tracking repo** — like the sibling REST project this workflow was adapted from, issues/milestones live in the centralized [financy-project/features](https://github.com/financy-project/features) repo, shared across `server`, `client`, and any future project in the org. Only `spec.md`/`plan.md`/`tasks.md` stay local, in `docs/features/` of the repo that implements the feature.

### Skills Reference

- `/scaffold` — Generate a new module's directory structure
- `/architecture-audit` — Validate a module against `docs/architecture/`
- `/write-test` — Check test file organization and one-describe-per-file compliance
- `/commit` — Create atomic, semantic commits (source + test grouped together)
- `/grill-me` — Interactively clarify requirements across all 13 planning areas
- `/feature-new`, `/feature-plan`, `/feature-task`, `/feature-status`, `/feature-list` — SDD workflow
- `/workflow` — Autonomous phase-by-phase stacked implementation
- `/fix-pr-review` — Apply PR review feedback and push the fix
- `/stack-pr` — Manage stacked PRs with the Graphite CLI

## Key Files

- `src/app.ts` — Apollo Server instance setup, context factory, module registration
- `src/server.ts` — Server startup with env-based port configuration
- `src/schema/build-schema.ts` — TypeGraphQL `buildSchema()` call, lists every module's resolvers
- `prisma/schema.prisma` — Database schema
- `prisma.config.ts` — Prisma CLI configuration
- `jest.config.ts` — Jest configuration with path alias mapping
- `tsconfig.json` — Extends base, target ES2022
- `tsconfig.build.json` — Excludes tests, used for production builds
- `docker-compose.dev.yml` / `docker-compose.integration.yml` / `docker-compose.e2e.yml` — Per-environment Postgres containers
