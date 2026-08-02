# 1. Module Structure

Every module follows this exact directory structure.

## Standard Module Layout

```
src/modules/<module-name>/
├── entity/
│   └── <name>.entity.ts               # Entity class, create() + fromRepository(), NO decorators
├── types/
│   └── index.ts                       # Plain TypeScript type definitions
├── enums/
│   └── <name>.enum.ts                 # Domain enums, SCREAMING_SNAKE_CASE keys
├── errors/
│   └── <module>-errors.ts             # Custom domain errors
├── graphql/
│   ├── object-types/
│   │   └── <name>.object-type.ts      # @ObjectType() — schema output shape
│   ├── input-types/
│   │   └── <action>.input.ts          # @InputType() + class-validator decorators
│   └── args/
│       └── <action>.args.ts           # @ArgsType() — grouped scalar arguments
├── validation/
│   └── <action>.validation.ts         # Wrapper: validateInput(InputClass, data)
├── mappers/
│   └── <name>.mapper.ts               # Pure functions: entity → object-type
├── repository/
│   └── <name>.repository.ts           # Data access layer
├── use-cases/
│   └── <action>.use-case.ts           # Business logic
├── resolvers/
│   └── <name>.resolver.ts             # @Resolver() — Query/Mutation/FieldResolver
├── loaders/                           # (Optional) Only if the module exposes relations
│   └── <name>.loader.ts               # DataLoader factory, built per-request
├── ports/                             # (Optional) For cross-module synchronous calls
├── adapters/                          # (Optional) For cross-module synchronous calls
├── gateways/                          # (Optional) For cross-module synchronous calls
├── index.ts                           # Barrel export (public API)
└── __tests__/
    ├── factories/
    │   └── <name>.factory.ts          # Test data generators
    ├── unit/
    │   ├── entity/
    │   │   └── <name>-create-describe.test.ts
    │   ├── validation/
    │   │   └── <action>-validation-describe.test.ts
    │   ├── use-cases/
    │   │   └── <action>-describe.test.ts
    │   └── mappers/
    │       └── <name>-mapper-describe.test.ts
    └── integration/
        ├── repository/
        │   └── <name>-repository-describe.test.ts
        └── e2e/
            └── <action>-describe.test.ts
```

## Real Example: User Module

```
src/modules/user/
├── entity/
│   └── user.entity.ts
├── types/
│   └── index.ts
├── enums/
│   └── user-status.enum.ts
├── errors/
│   └── user-errors.ts
├── graphql/
│   ├── object-types/
│   │   └── user.object-type.ts
│   ├── input-types/
│   │   └── register-user.input.ts
│   └── args/
│       └── find-user.args.ts
├── validation/
│   └── register-user.validation.ts
├── mappers/
│   └── user.mapper.ts
├── repository/
│   └── user.repository.ts
├── use-cases/
│   └── register-user.use-case.ts
├── resolvers/
│   └── user.resolver.ts
├── index.ts
└── __tests__/
    ├── factories/
    │   └── user.factory.ts
    ├── unit/
    │   ├── entity/
    │   │   └── user-create-describe.test.ts
    │   ├── validation/
    │   │   └── register-user-validation-describe.test.ts
    │   ├── use-cases/
    │   │   └── register-user-describe.test.ts
    │   └── mappers/
    │       └── user-mapper-describe.test.ts
    └── integration/
        ├── repository/
        │   └── user-repository-describe.test.ts
        └── e2e/
            └── register-user-describe.test.ts
```

## Naming Conventions

### Files

| File Type   | Pattern                               | Example                        | Rules                          |
| ----------- | ------------------------------------- | ------------------------------ | ------------------------------ |
| Entity      | `<name>.entity.ts`                    | `user.entity.ts`               | Singular, main domain object   |
| Repository  | `<name>.repository.ts`                | `user.repository.ts`           | Singular, matches entity       |
| Use-Case    | `<verb>-<noun>.use-case.ts`           | `register-user.use-case.ts`    | Verb-noun format               |
| Resolver    | `<name>.resolver.ts`                  | `user.resolver.ts`             | Module/entity name             |
| Object Type | `<name>.object-type.ts`               | `user.object-type.ts`          | Schema-facing output shape     |
| Input Type  | `<action>.input.ts`                   | `register-user.input.ts`       | Action name                    |
| Args Type   | `<action>.args.ts`                    | `find-user.args.ts`            | Action name                    |
| Validation  | `<action>.validation.ts`              | `register-user.validation.ts`  | Action name                    |
| Mapper      | `<name>.mapper.ts`                    | `user.mapper.ts`               | Singular, matches entity       |
| Loader      | `<relation>.loader.ts`                | `orders-by-user.loader.ts`     | Describes the batched relation |
| Error       | `<module>-errors.ts`                  | `user-errors.ts`               | Module name, plural            |
| Factory     | `<name>.factory.ts`                   | `user.factory.ts`              | Singular                       |
| Types       | `index.ts`                            | `types/index.ts`               | Fixed name in types folder     |
| Test        | `<subject>-<action>-describe.test.ts` | `user-create-describe.test.ts` | Matches implementation         |

### Directories

| Folder                  | Purpose                      | Rules                                                      |
| ----------------------- | ---------------------------- | ---------------------------------------------------------- |
| `entity/`               | Domain objects               | One file per entity, no decorators                         |
| `types/`                | Plain TS type definitions    | Central, one `index.ts`                                    |
| `enums/`                | Domain enums                 | SCREAMING_SNAKE_CASE keys                                  |
| `errors/`               | Domain errors                | One file per module                                        |
| `graphql/object-types/` | `@ObjectType()` classes      | Output only, never accept input                            |
| `graphql/input-types/`  | `@InputType()` classes       | Schema + `class-validator` decorators, one source of truth |
| `graphql/args/`         | `@ArgsType()` classes        | Grouped scalar arguments                                   |
| `validation/`           | Validation wrappers          | Calls `validateInput()` on an Input/Args class             |
| `mappers/`              | Entity ↔ GraphQL translation | Pure functions only                                        |
| `repository/`           | Data access                  | One file per entity                                        |
| `use-cases/`            | Business logic               | One file per action                                        |
| `resolvers/`            | GraphQL binding              | One file per module (may group multiple queries/mutations) |
| `loaders/`              | DataLoader factories         | One file per batched relation                              |
| `__tests__/`            | All tests                    | Mirrors src structure                                      |

## Barrel Export

Each module exports its public API in `index.ts`:

```typescript
// src/modules/user/index.ts

// Entities
export { User } from './entity/user.entity'

// Repository
export { UserRepository } from './repository/user.repository'

// Errors
export { UserNotFoundError, UserAlreadyExistsError } from './errors/user-errors'

// Enums
export { UserStatus } from './enums/user-status.enum'

// Types
export type { UserProps, CreateUserProps } from './entity/user.entity'

// Resolver (registered in the schema builder)
export { UserResolver } from './resolvers/user.resolver'
```

**Key Rules:**

- Only public API in barrel export
- **NOT exported:** use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders
- **Always import from `@/modules/<name>` only** (never from subdirectories)
- The resolver IS exported — the schema builder needs the class reference to register it

## Shared Code Structure

Code shared across modules lives in `src/shared/`:

```
src/shared/
├── database/
│   └── create-user-with-related.ts   # Multi-module operations
├── errors/
│   ├── domain-error.ts               # Base error class + DomainErrorCode
│   ├── validation-error.ts           # Validation errors
│   └── index.ts                      # Barrel export
├── utils/
│   ├── uuid.ts                       # UUID generation
│   ├── validate-input.ts             # class-validator wrapper
│   └── index.ts
└── index.ts
```

## Module Registration

Modules are registered in the schema builder, not a router:

```typescript
// src/schema/build-schema.ts
import { buildSchema } from 'type-graphql'
import { UserResolver } from '@/modules/user'
import { AuthResolver } from '@/modules/auth'

export const buildAppSchema = () =>
  buildSchema({
    resolvers: [UserResolver, AuthResolver],
    validate: false, // input validation is handled explicitly by our validation wrapper, not TypeGraphQL's automatic pass
    emitSchemaFile: true, // schema.graphql is committed — see 12-graphql-operational-concerns.md
  })
```

## File Size Guidelines

Keep files focused:

- **Entity:** Max 100 lines
- **Repository:** Max 150 lines
- **Use-Case:** Max 200 lines
- **Resolver:** Max 100 lines
- **GraphQL Type (ObjectType/InputType/ArgsType):** Max 50 lines
- **Mapper:** Max 50 lines
- **Test:** Max 300 lines (one describe per file)

If a file exceeds limits, split into smaller files.

---

Next: [Entities](02-entities.md)
