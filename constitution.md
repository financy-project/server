# Constitution

This document defines the foundational principles, values, and architectural patterns that govern development in this project. All code, features, and decisions must align with these principles.

## Philosophy

We believe in **Specification-Driven Development (SDD)**: features are defined by written specifications before implementation begins. This ensures clarity, reduces rework, and makes edge cases explicit.

We value **testability, clarity, and maintainability** over cleverness. Code should be easy to reason about, and business logic should be explicit.

> **Architecture in transition.** As of the `refactor/flatten-dashboard-category-transaction` work, this project runs **two coexisting architectures**:
>
> - **`auth`, `user`, `health`** still follow the module-based DDD pattern below (§ [Module Structure](#module-structure), § [Module Boundary Isolation](#module-boundary-isolation), § [Cross-Module Communication](#cross-module-communication)).
> - **`category`, `transaction`, `dashboard`** were deliberately flattened — see § [Flat Architecture](#flat-architecture-category-transaction-dashboard) below. The module-based pattern (ports/adapters/gateways, one folder tree per bounded context) was judged **too much ceremony for this project's actual size and team**: every cross-domain read needed a port + adapter + gateway (3 files + barrel updates) to do what a direct function call does in one line, and the use-case layer added a layer of indirection between the resolver and the repository without adding real business logic.
>
> This is the project's current direction. New backend work on `category`, `transaction`, or `dashboard` **must** follow the flat pattern. `auth`/`user`/`health` stay as-is until (if ever) they're migrated — do not mix the two patterns within the same domain.

## Architectural Principles

### Function-First DDD (with a GraphQL exception)

All exports must be **const objects containing pure functions** — **never use classes** — with four narrow, explicit exceptions required by the stack:

1. **Domain entities** — immutable objects with a private constructor and factory methods
2. **Typed error classes** — extending `DomainError`
3. **GraphQL type classes** — `@ObjectType()`, `@InputType()`, `@ArgsType()` (TypeGraphQL requires decorated classes to build the schema)
4. **Resolver classes** — `@Resolver()` (TypeGraphQL requires a decorated class to register `@Query()`/`@Mutation()`/`@FieldResolver()` methods)

Everything else — use-cases, repositories, services, gateways, adapters, mappers, loaders — stays a **const object of pure functions**:

```ts
// ✅ correct — use-case
export const HealthUseCase = {
  getHealth(): HealthStatus {
    return { status: 'ok', uptime: process.uptime() }
  },
}

// ✅ allowed exception — GraphQL type (schema contract)
@ObjectType()
export class HealthStatusType {
  @Field()
  status!: string

  @Field()
  uptime!: number
}

// ❌ forbidden — a use-case, repository, or service written as a class
export class HealthUseCase {
  getHealth() { ... }
}
```

**Why:** Functions are simpler to test, compose, and reason about. The four exceptions exist because the frameworks we depend on (TypeGraphQL, our error hierarchy) require decorated or `new`-able classes to work at all — every other layer has no such constraint and stays functional.

### Layered Architecture

Data flows: `resolver → use-case → entity / repository / service`

There is no separate "router" or "controller" layer — TypeGraphQL resolvers absorb both responsibilities (schema binding + input handling) that a REST router/controller pair would otherwise split.

- **Resolver** — binds a `@Query`/`@Mutation`/`@FieldResolver` to the schema, validates input (via `class-validator` on the input type), delegates to the use-case, maps the returned entity to a GraphQL type
- **Use-case** — business logic orchestration, returns domain types only (never a GraphQL type)
- **Entity / Repository / Service** — domain logic and data access

**Why:** Clear separation of concerns makes it easy to test each layer independently and refactor without affecting others. Keeping the resolver thin means business logic is testable without spinning up Apollo Server.

### Module Boundary Isolation

> Applies to `auth`, `user`, `health`. `category`, `transaction`, and `dashboard` deliberately drop this boundary — see [Flat Architecture](#flat-architecture-category-transaction-dashboard).

**Modules are the only isolation boundary** — direct imports between modules are **forbidden**.

```ts
// ❌ forbidden
import { UserUseCase } from '@/modules/user/use-cases/user.use-case'

// ✅ correct
// Use domain events or a port/adapter/gateway instead
```

**Why:** Direct imports create hidden dependencies that make refactoring and testing difficult. Modules should be loosely coupled.

### Public API via Barrel Exports

Consumers of a module import from `modules/<name>/` only, never from subpaths:

```ts
// ✅ correct
import { HealthUseCase } from '@/modules/health'

// ❌ forbidden
import { HealthUseCase } from '@/modules/health/use-cases/health.use-case'
```

**Why:** Barrel exports (`index.ts`) act as a contract — internal refactoring is invisible to consumers.

### Domain Entities Never Touch GraphQL

The domain entity and the GraphQL type exposed on the schema are **always two separate classes**, connected by a pure mapper function. A resolver never returns an entity directly.

```
entity/user.entity.ts          # pure domain object, no decorators, no framework awareness
graphql/object-types/user.object-type.ts   # @ObjectType(), schema-facing shape
mappers/user.mapper.ts         # toUserType(entity: User): UserType
```

**Why:** If the entity _were_ the `@ObjectType`, every domain refactor (renaming a field, splitting a value object) would silently break the public schema — a breaking API change with no compiler signal. The mapper is the one place that translates between "what the domain needs" and "what we promise API consumers," the same role a barrel export plays between modules.

## Development Patterns

> The two sections immediately below (Module Structure, and the pattern sections that follow it) describe the **legacy module-based DDD pattern**, still authoritative for `auth`, `user`, `health`. For `category`, `transaction`, `dashboard`, skip ahead to [Flat Architecture](#flat-architecture-category-transaction-dashboard).

### Module Structure

```
src/modules/<name>/
  ├── entity/
  │   ├── index.ts                          # Internal barrel: export entities
  │   └── <name>.entity.ts                  # Domain entity — private constructor, create() & fromRepository(), NO decorators
  ├── types/
  │   └── index.ts                          # Plain TS types (Props, CreateProps) — not GraphQL-aware
  ├── enums/
  │   └── <name>.enum.ts                    # Domain enums, SCREAMING_SNAKE_CASE keys; registered via registerEnumType() only if exposed on the schema
  ├── errors/
  │   ├── index.ts                          # Internal barrel: export errors
  │   └── <name>-errors.ts                  # Domain errors extending DomainError
  ├── graphql/
  │   ├── index.ts                          # Internal barrel: object-types, inputs, args
  │   ├── object-types/
  │   │   └── <name>.object-type.ts         # @ObjectType() — schema-facing DTO
  │   ├── input-types/
  │   │   └── <action>.input.ts             # @InputType() + class-validator decorators (schema + validation, one source of truth)
  │   └── args/
  │       └── <action>.args.ts              # @ArgsType() — grouped scalar arguments
  ├── mappers/
  │   └── <name>.mapper.ts                  # Pure functions: entity → object-type
  ├── repository/
  │   ├── index.ts                          # Internal barrel: export from implementation
  │   └── <name>.repository.ts              # Data access layer (Prisma internal, returns entities)
  ├── ports/                                # (Optional) Port definitions for other modules
  ├── adapters/                             # (Optional) Adapters implementing ports from other modules
  ├── gateways/                             # (Optional) Orchestration layer for cross-module calls
  ├── loaders/                              # (Optional) DataLoader factories for this module's relations
  │   ├── index.ts
  │   └── <name>.loader.ts                  # buildXLoader(context) — created per-request, never a module-level singleton
  ├── use-cases/
  │   ├── index.ts                          # Internal barrel: export use-cases
  │   └── <action>.use-case.ts              # Orchestrator: coordinates entities, repositories, gateways
  ├── resolvers/
  │   ├── index.ts                          # Internal barrel: export resolvers
  │   └── <name>.resolver.ts                # @Resolver() class: Query/Mutation/FieldResolver methods
  ├── index.ts                              # Public API (barrel export: entities, errors, resolvers, adapters)
  └── __tests__/
      ├── unit/                             # Unit tests (mocked repositories, services)
      ├── integration/                      # Integration tests (real database)
      ├── e2e/                              # End-to-end tests (full Apollo Server stack)
      └── factories/                        # Test data factories
```

### Flat Architecture (category, transaction, dashboard)

No module folders, no `index.ts` barrels, no ports/adapters/gateways, no use-case layer. Domains live as flat, top-level buckets and call each other's repositories directly — there is no isolation boundary to route around:

```
src/
  entities/
    category.entity.ts        # Category class + its domain errors (CategoryNotFoundError, ...), colocated
    transaction.entity.ts     # Transaction class + TransactionKind enum + its domain errors, colocated
  repositories/
    category.repository.ts    # Prisma internals, returns entities — the only data-access layer
    transaction.repository.ts
  graphql/
    category.types.ts         # CategoryType (@ObjectType), Create/UpdateCategoryInput (@InputType + class-validator),
                               # CategoryIdArgs, and the toCategoryType()/toUpdateCategoryPatch() mapper functions —
                               # one file per domain, schema shape + validation + mapping together
    transaction.types.ts
    dashboard.types.ts        # Read-model types only — dashboard has no entity/repository of its own,
                               # it composes CategoryRepository + TransactionRepository
  loaders/
    categories-by-id.loader.ts               # buildXLoader() factories, instantiated per-request in create-context.ts
    transactions-quantity-by-category-id.loader.ts
  resolvers/
    category.resolver.ts      # @Resolver() class — Query/Mutation/FieldResolver methods call repositories directly;
    transaction.resolver.ts   # this is where the old use-case's orchestration logic now lives
    dashboard.resolver.ts
  __tests__/
    unit/entity/               # Entity behavior (create/fromRepository/belongsTo)
    unit/graphql/               # class-validator input validation + mapper functions
    unit/loaders/                # DataLoader batching/dedup/ordering (mocked repository)
    integration/repository/      # Real-database repository tests
    integration/e2e/<domain>/    # Real GraphQL documents against the built schema — the primary coverage
                                  # for resolver-level orchestration (no isolated use-case to unit-test anymore)
```

**What moved where, compared to the module pattern:**

| Legacy module concept                                                     | Flat equivalent                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity/`, `errors/`                                                      | Merged into `entities/<name>.entity.ts` — an entity and the errors it can raise are one unit                                                                                                                                                              |
| `repository/`                                                             | `repositories/<name>.repository.ts` — unchanged responsibility, just relocated                                                                                                                                                                            |
| `graphql/object-types`, `graphql/input-types`, `graphql/args`, `mappers/` | Merged into `graphql/<name>.types.ts` — schema shape, validation, and the entity↔type mapper live together                                                                                                                                                |
| `use-cases/`                                                              | **Gone.** Business logic (ownership checks, orchestrating two repositories) lives directly in the resolver method. There is nothing left to unit-test in isolation once the layer is this thin — e2e tests (real schema, real DB) are the coverage for it |
| `ports/`, `adapters/`, `gateways/`                                        | **Gone.** A resolver, loader, or another domain's repository just imports the repository it needs directly (e.g. `category.resolver.ts` imports `TransactionRepository` to reassign transactions on delete)                                               |
| `loaders/` (per-module)                                                   | `loaders/` at the project root, one file per loader — same DataLoader-per-request rule as before                                                                                                                                                          |
| `index.ts` barrels                                                        | **Gone.** Import the concrete file directly (`@/repositories/category.repository`, `@/graphql/category.types`) — there is no module boundary for a barrel to protect                                                                                      |

**Why this is still safe:**

- **Repository stays the single data-access layer.** No file outside `repositories/` calls `prisma.*` directly. This is the one boundary from the old architecture that was never overhead — it's what makes repository tests possible against a real database, and it's what a resolver mocks in a unit test if one is ever needed.
- **Entity ≠ GraphQL type still holds.** `Category` (entity) and `CategoryType` (`@ObjectType`) are still two classes connected by `toCategoryType()` — collapsing modules didn't collapse that boundary, because it protects the public schema from internal refactors, not from other domains.
- **No GraphQL type duplication across domains.** The old module pattern deliberately duplicated `TransactionCategoryType` next to `CategoryType` to avoid a cross-module GraphQL dependency. Flat architecture has no such dependency to avoid, so `transaction.category` field resolver returns `CategoryType` directly — one shape, one mapper, no drift between the two.
- **DataLoader is still mandatory for relational fields** — `TransactionResolver.category` and `CategoryResolver.transactionsQuantity` are still `@FieldResolver`s backed by a per-request `DataLoader`, exactly as before. Flattening removed indirection, not the N+1 guard.

**When to reach for a use-case again:** if a single resolver method's orchestration logic grows past what fits comfortably in one method (multiple repositories, several branches, logic reused by two different resolvers), extract it back into a plain function — but keep it a function in the same file or a sibling file, not a new `use-cases/` folder with its own barrel. The flat structure is a default, not a hard ceiling.

### Entity Pattern

Entities are **immutable domain objects** containing business logic — identical to a REST-based project, since the entity has no idea GraphQL exists:

```ts
export type UserProps = {
  id: string
  email: string
  name: string
  statusId: string
}

export class User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly statusId: string

  private constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.name = props.name
    this.statusId = props.statusId
  }

  static create(input: Omit<UserProps, 'id'>): User {
    return new User({ id: generateUUID(), ...input })
  }

  static fromRepository(props: UserProps): User {
    return new User(props)
  }

  // Business logic lives here
  isActive(): boolean {
    return this.statusId === 'ACTIVE'
  }
}
```

- Constructor is **private** (enforce via static factories)
- All properties are **readonly** (immutability)
- `create()` for new entities (generates IDs, defaults, enforces domain invariants)
- `fromRepository()` for database reconstruction
- **Business rules as methods** (e.g., `isActive()`)
- No side effects (no database, HTTP, or GraphQL/decorator awareness)

### GraphQL Type Pattern

Three decorated class shapes, each with one job:

```ts
// graphql/object-types/user.object-type.ts — schema-facing output shape
@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string

  @Field()
  email!: string

  @Field()
  name!: string
}

// graphql/input-types/register-user.input.ts — schema input AND validation, same class
@InputType()
export class RegisterUserInput {
  @Field()
  @IsEmail()
  email!: string

  @Field()
  @Length(2, 100)
  name!: string

  @Field()
  @MinLength(8)
  password!: string
}

// graphql/args/find-user.args.ts — grouped scalar args for a query
@ArgsType()
export class FindUserArgs {
  @Field(() => ID)
  id!: string
}
```

- `@ObjectType()` classes are **output only** — never accept user input
- `@InputType()` classes double as the **validation schema**: `class-validator` decorators on the same fields TypeGraphQL uses to build the schema, so there is exactly one source of truth for "what does this mutation accept," not a GraphQL input class plus a separate Zod/Joi schema
- `class-validator` enforces **syntactic** validity (format, length, required) at the API boundary; the entity's `create()` still enforces **domain invariants** (business rules) — defense in depth, not duplication
- Mapping between entity and `@ObjectType` happens **only** in `mappers/<name>.mapper.ts`, as pure functions

### Resolver Pattern (replaces Router + Controller)

Resolvers handle **GraphQL binding only** — validate input, delegate to the use-case, map the result, never contain business logic:

```ts
@Resolver(() => UserType)
export class UserResolver {
  @Mutation(() => UserType)
  async registerUser(
    @Arg('input') input: RegisterUserInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<UserType> {
    const user = await RegisterUserUseCase.registerUser(input)
    return toUserType(user)
  }

  @FieldResolver(() => [OrderType])
  async orders(
    @Root() user: UserType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<OrderType[]> {
    const orders = await ctx.loaders.ordersByUserId.load(user.id)
    return orders.map(toOrderType)
  }
}
```

- `@Resolver()` class is the one allowed exception alongside entities/errors/GraphQL types
- Delegate **all business logic** to use-cases
- Map every returned entity through the module's mapper before returning it
- `@FieldResolver` methods for relational/computed fields **must** batch through a `DataLoader` from `ctx.loaders` — never call the repository directly inside a field resolver (N+1 query risk)
- Let domain errors **bubble up unmodified** — a global Apollo error formatter (not the resolver) translates `DomainError` subclasses into `GraphQLError` with `extensions.code` and an i18n-translated message

### Use-Case Pattern

Use-cases are **orchestrators** — identical role to a REST project, they never know a GraphQL type exists:

```ts
const registerUser = async (input: RegisterUserInput): Promise<User> => {
  const existingUser = await findUserByEmail(input.email)
  if (existingUser) {
    throw new UserAlreadyExistsError(input.email)
  }

  const user = User.create({ email: input.email, name: input.name })
  const hashedPassword = await HashService.hash(input.password)

  await UserRepository.create({ user, password: hashedPassword })

  EventEmitter.emit('user.created', { userId: user.id, email: user.email })

  return user
}

export const RegisterUserUseCase = {
  registerUser,
}
```

- Use **arrow functions** defined outside the object
- **Business logic lives in entities**, not use-cases
- Use-cases **coordinate** entities, repositories, gateways, and services
- Call **gateways**, not adapters directly
- Return only domain types (entities or value objects) — **never** a `@ObjectType()`
- Emit events **without await** (fire-and-forget)

### Repository Pattern

Repositories handle **data access only** — identical to a REST project:

```ts
import { prisma } from '@/lib/prisma'
import { User } from '../entity/user.entity'
import { UserNotFoundError } from '../errors/user-errors'

const findByEmail = async (email: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    throw new UserNotFoundError(email)
  }

  return User.fromRepository(user)
}

export const UserRepository = {
  findByEmail,
}
```

- Use **arrow functions** defined outside the object
- Import Prisma **internally** (never as parameter)
- Use `findUnique + validation` (not `findUniqueOrThrow`)
- Convert database responses to domain entities via `.fromRepository()`
- Throw **custom domain errors** with i18n (never generic errors)
- Return only domain entities, never raw database records

### Service Pattern

Services provide **utility functions** for cross-cutting concerns (hashing, email, i18n, events) — identical to a REST project:

```ts
const hash = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10)
}

const compare = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

export const HashService = {
  hash,
  compare,
}
```

- Use **arrow functions** defined outside the object, **named** (not anonymous)
- Services are **stateless** (no instance state, only pure logic)
- Import dependencies at the top

## Where Business Logic Lives

| Layer          | Responsibility                                              | Example                                                                   |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Entity**     | Business rules & transformations                            | `user.isActive()`, `isEmailVerified()`                                    |
| **Use-Case**   | Coordinate entities, repos, gateways                        | Check conditions, call repos, call gateways, emit events                  |
| **Gateway**    | Validation & orchestration for cross-module calls           | Validate input, call adapter, handle errors                               |
| **Adapter**    | Implement ports from other modules                          | Query repo, translate to port's DTO, return data                          |
| **Resolver**   | GraphQL binding, input validation trigger, response mapping | Validate input (class-validator), call use-case, map entity → object-type |
| **Mapper**     | Entity ↔ GraphQL type translation                           | `toUserType(user: User): UserType`                                        |
| **Repository** | Data access only                                            | Query database, convert to entities                                       |

**The rule:** If it's about the domain (user status, email verification), it goes in the entity. If it's about orchestrating multiple internal parts, it goes in the use-case. If it's about calling another module safely, it goes in the gateway. If it's about the GraphQL schema boundary (binding, mapping), it goes in the resolver or mapper.

## Testing Philosophy

**TDD is mandatory.** Write the failing test first, commit it, then implement.

### Test Structure

```
__tests__/
  unit/            # Isolated with mocks (jest.mock)
  integration/     # Real database, Docker Compose (no mocks of data layer)
  e2e/             # Full stack via server.executeOperation() (no mocks, real schema)
```

- **Unit tests**: Mock dependencies, test one layer in isolation (resolvers, use-cases, mappers)
- **Integration tests**: Use real database, test data layer + business logic (repositories)
- **E2E tests**: Test full GraphQL request → response cycle by executing real operations against the built schema

**Why:** Different test types catch different kinds of failures. Unit tests are fast, integration tests find data issues, E2E tests find schema/resolver wiring problems.

### Repository Tests are Integration Tests

All **repository tests must be integration tests** — they test against the real database using Prisma, not mocks:

- Place repository tests in `__tests__/integration/`
- Use `useDatabase()` helper to set up test database
- Import and use real `prisma` instance
- Tests cover CRUD operations, error handling, and data transformations

### E2E Tests Exercise the Real Schema

- Build the schema once via `buildSchema()` (TypeGraphQL) and reuse it across e2e tests in a module
- Execute real GraphQL documents (queries/mutations as strings) through `server.executeOperation()` — never call a resolver method directly in an e2e test, that's what unit tests are for
- Assert on the GraphQL response shape (`data`, `errors[].extensions.code`), not on internal types

## Code Conventions

- **File naming**: module name prefix + layer suffix: `user.entity.ts`, `user.repository.ts`, `user.resolver.ts`, `user.object-type.ts`, `register-user.input.ts`, `find-user.args.ts`, `register-user.use-case.ts`, `user.mapper.ts`, `orders-by-user.loader.ts`. The `.test.ts` suffix is kept as-is.
- **Code style**: Prettier (2-space indent, no semicolons, 80-char line width) and ESLint. Max 200 lines per file.
- **Comments**: Default to none. Only add when the WHY is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug.
- **Imports**: Use path aliases (`@/`). No relative imports beyond the module boundary.

## Cross-Module Communication

> Applies to `auth`, `user`, `health` — modules with a real isolation boundary to cross. `category`, `transaction`, and `dashboard` have no such boundary (see [Flat Architecture](#flat-architecture-category-transaction-dashboard)): they call each other's repositories directly, no port/adapter/gateway needed.

Two primary approaches for cross-module interaction — unchanged by the transport layer:

### 1. Event-Driven (Asynchronous)

1. Define the event type in a shared domain layer
2. Module B emits the event after its use-case completes (fire-and-forget)
3. Module A subscribes and handles the event

**When to use:** State changes, auditing, notifications, async workflows

### 2. Ports & Adapters & Gateways (Synchronous)

**Three-layer pattern:**

1. **Port** — Type definition in the **requester module** that describes what it needs
2. **Adapter** — Function in the **requested module** that implements the port
3. **Gateway** — Abstraction in the **requester module** that calls the adapter with validation/orchestration

```
requester-module/
  ├── ports/service-name.port.ts
  ├── gateways/service-name.gateway.ts
  └── use-cases/               # Calls gateway, not adapter directly

requested-module/
  └── adapters/service-name.adapter.ts
```

**Why:** True module isolation with synchronous dependencies. Ports owned by requester ensure type safety; adapters owned by requested module implement the contract; gateways encapsulate validation and orchestration without polluting use-cases.

## GraphQL-Specific Concerns

These have no equivalent in a REST project and need explicit rules of their own.

### Schema is Code-First and Committed

TypeGraphQL decorators are the single source of truth for the schema. The generated `schema.graphql` (emitted by `buildSchema({ emitSchemaFile: true })`) is **committed to the repo**, not gitignored — PR diffs must show schema changes explicitly, the same way a migration file shows a database change.

### DataLoader is Mandatory for Relational Fields

Any `@FieldResolver` that resolves a relation (e.g., `User.orders`, `Order.items`) **must** go through a `DataLoader`, never a direct repository call. Loaders are:

- Defined per module in `loaders/<name>.loader.ts` as a factory function (`buildOrdersByUserIdLoader(): DataLoader<...>`)
- Instantiated **once per request** inside the Apollo `context` function — never as a module-level singleton (a singleton loader leaks cached data across unrelated requests/users)

**Why:** GraphQL's nested-query shape makes N+1 database calls the default failure mode, not an edge case.

### Query Complexity and Depth Limits are Enforced Server-Wide

Apollo Server is configured with a query complexity/depth validation rule (e.g., `graphql-query-complexity`). Fields with non-trivial cost (list-returning fields, deep relations) declare an explicit `complexity` option. A query exceeding the configured budget is rejected before execution, not after.

**Why:** Unlike a REST endpoint, a single GraphQL query can request unbounded nested data — this is the schema-level equivalent of rate limiting.

### Context is the Only Way to Reach Request State

A single `createContext({ req }): GraphQLContext` function builds a request-scoped object containing the authenticated user (if any), the request-scoped DataLoaders, and the i18n locale. Resolvers and use-cases access it via the `@Ctx()` argument — **never** through a module-level global or `req` reached out-of-band.

- Authentication is resolved **once**, in `createContext`, exposed as `ctx.currentUser`
- Per-field/per-mutation authorization is still checked explicitly where it matters (resolver or use-case) — a valid `ctx.currentUser` is not implicit permission for every operation

### Errors are Translated at the Formatter, Not the Resolver

Resolvers and use-cases throw the same `DomainError` subclasses a REST project would. A single Apollo `formatError` (or plugin) is the only place that:

1. Maps a `DomainError` subclass to a GraphQL `extensions.code` (e.g., `NOT_FOUND`, `BAD_USER_INPUT`, `UNAUTHENTICATED`)
2. Translates the error's i18n key into the response message

Resolvers never catch and reformat errors themselves.

## Specification-Driven Development (SDD)

### Definition of Ready (DoR) for Planning

Before breaking a plan into tasks, it must meet our architectural DoR (see `docs/architecture/11-dor.md`). If a layer is unnecessary, the plan must explicitly state the omission and justify it.

**Core rules:**

- Write the spec first (user stories, acceptance criteria)
- Use `/grill-me` to surface edge cases before planning — GraphQL-specific areas (complexity limits, DataLoader batching, schema breaking changes) are asked in addition to the general 13 planning areas
- Write the plan with architecture and design decisions
- Break the plan into tasks (`B-001`, `B-002`, ...)
- Implement task-by-task, checking off as you go
- Use `/feature-status` to track real-time progress

## No Half-Finished Code

- Don't add features beyond what the task requires
- Don't refactor or add abstractions for hypothetical future requirements
- Don't add error handling for scenarios that can't happen
- Three similar lines is better than a premature abstraction

**Why:** Incomplete work becomes technical debt. Keep scope tight and explicit.

## Practical Implementation Patterns

This document defines principles. Concrete implementation patterns with code examples live in [docs/architecture/](docs/architecture/README.md):

- **[01-module-structure.md](docs/architecture/01-module-structure.md)** — How to organize modules
- **[02-entities.md](docs/architecture/02-entities.md)** — Entity pattern with factories
- **[03-repository.md](docs/architecture/03-repository.md)** — Data access layer pattern
- **[04-errors-and-i18n.md](docs/architecture/04-errors-and-i18n.md)** — Error handling, i18n keys, Apollo error formatting
- **[05-validation.md](docs/architecture/05-validation.md)** — `class-validator` on `@InputType()` classes
- **[06-graphql-types.md](docs/architecture/06-graphql-types.md)** — ObjectType/InputType/ArgsType conventions, mapper pattern
- **[07-use-cases-and-resolvers.md](docs/architecture/07-use-cases-and-resolvers.md)** — Business logic and GraphQL binding
- **[08-testing.md](docs/architecture/08-testing.md)** — Test structure and patterns, `executeOperation()` e2e style
- **[09-configuration.md](docs/architecture/09-configuration.md)** — Environment and shared utilities
- **[10-cross-module-communication.md](docs/architecture/10-cross-module-communication.md)** — Events and Ports & Adapters patterns
- **[11-dor.md](docs/architecture/11-dor.md)** — Required blueprints for feature planning
- **[12-graphql-operational-concerns.md](docs/architecture/12-graphql-operational-concerns.md)** — DataLoader, query complexity, context, schema artifact policy
- **[13-backend-development-checklist.md](docs/architecture/13-backend-development-checklist.md)** — Layer-by-layer implementation guide
- **[14-feature-planning-checklist.md](docs/architecture/14-feature-planning-checklist.md)** — 13 planning areas for `plan.md`
- **[checklist.md](docs/architecture/checklist.md)** — Pre-PR validation checklist

## Key Files

- `src/app.ts` — Apollo Server instance setup, context factory, module registration
- `src/server.ts` — Server startup
- `src/schema/build-schema.ts` — TypeGraphQL `buildSchema()` call, lists every module's resolvers
- `prisma/schema.prisma` — Database schema
- `jest.config.ts` — Jest configuration
- `tsconfig.json` — Extends base, target ES2022
- `tsconfig.build.json` — Excludes tests, used for production builds
- `CLAUDE.md` — Operational guidance and commands
- `docs/architecture/` — Practical patterns and implementation examples
