# Architecture Patterns

Practical reference guide for implementing features following the project's architecture. This documentation complements `CLAUDE.md` and `constitution.md` with concrete file structures, patterns, and examples for our **GraphQL + Apollo Server + TypeGraphQL + Prisma** stack.

**Key Rule:** All patterns are mandatory. They are not suggestions — they are the standard.

---

## Quick Navigation

- **[01. Module Structure](01-module-structure.md)** — How to organize files and directories
- **[02. Entities](02-entities.md)** — Entity class pattern with factories
- **[03. Repository](03-repository.md)** — Data access layer with Prisma
- **[04. Errors & i18n](04-errors-and-i18n.md)** — Custom errors and Apollo error formatting
- **[05. Validation](05-validation.md)** — `class-validator` on `@InputType()`/`@ArgsType()` classes
- **[06. GraphQL Types](06-graphql-types.md)** — ObjectType/InputType/ArgsType + mapper pattern
- **[07. Use-Cases & Resolvers](07-use-cases-and-resolvers.md)** — Business logic and GraphQL binding
- **[08. Testing](08-testing.md)** — Unit, integration, and e2e test patterns
- **[09. Configuration](09-configuration.md)** — Environment variables and shared utilities
- **[10. Cross-Module Communication](10-cross-module-communication.md)** — Events and Ports & Adapters patterns
- **[11. Definition of Ready (DoR)](11-dor.md)** — Required blueprints for feature planning
- **[12. GraphQL Operational Concerns](12-graphql-operational-concerns.md)** — DataLoader, query complexity, context, schema policy
- **[13. Backend Development Checklist](13-backend-development-checklist.md)** — Layer-by-layer implementation guide
- **[14. Feature Planning Checklist](14-feature-planning-checklist.md)** — 13 planning areas for `plan.md`
- **[Checklist](checklist.md)** — Pre-PR validation checklist

---

## How to Use This Guide

1. **Creating a new module?** Start with [Module Structure](01-module-structure.md), then follow the order
2. **Implementing a specific layer?** Jump to the relevant section (e.g., [Repository](03-repository.md))
3. **Module needs to communicate with another?** See [Cross-Module Communication](10-cross-module-communication.md)
4. **Writing a `plan.md`?** First check the [DoR](11-dor.md) — your plan must include explicit blueprints, including the GraphQL Blueprint
5. **Adding a relational field or a list-returning field?** See [GraphQL Operational Concerns](12-graphql-operational-concerns.md) before writing the resolver
6. **Writing tests?** See [Testing](08-testing.md)
7. **Before merging?** Use the [Checklist](checklist.md)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                  GraphQL Operation                        │
├──────────────────────────────────────────────────────────┤
│  Resolver → Use-Case → Repository / Entity / Gateway      │
│     ↑                                                     │
│  Mapper ← Entity            (GraphQL Type ← Entity)        │
├──────────────────────────────────────────────────────────┤
│           Domain Logic & Validation (class-validator)      │
├──────────────────────────────────────────────────────────┤
│  Errors (i18n, formatError) | Services | Shared Utilities  │
├──────────────────────────────────────────────────────────┤
│                  Database (Prisma)                         │
└──────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Resolver** — Binds Query/Mutation/FieldResolver to the schema, validates input, delegates to use-case, maps output
2. **Use-Case** — Business logic orchestration, no GraphQL concerns, returns entities only
3. **Repository** — Data access, only layer that knows Prisma
4. **Entity** — Immutable domain object, pure functions, no framework awareness
5. **GraphQL Types** — `@ObjectType()`/`@InputType()`/`@ArgsType()`, schema boundary
6. **Mapper** — Pure function translating entity → GraphQL type
7. **Validation** — `class-validator` decorators on Input/Args types + `validateInput()` wrapper
8. **Errors** — Custom domain errors with i18n messages, translated once in Apollo `formatError`
9. **Loaders** — `DataLoader` factories for relational fields, request-scoped
10. **Services** — Reusable utilities (hash, i18n, etc.)

There is no separate router or controller layer — the resolver absorbs both responsibilities.

---

## File Naming Conventions

| Type        | Pattern                     | Example                       |
| ----------- | --------------------------- | ----------------------------- |
| Entity      | `<name>.entity.ts`          | `user.entity.ts`              |
| Repository  | `<name>.repository.ts`      | `user.repository.ts`          |
| Use-Case    | `<verb>-<noun>.use-case.ts` | `register-user.use-case.ts`   |
| Resolver    | `<name>.resolver.ts`        | `user.resolver.ts`            |
| Object Type | `<name>.object-type.ts`     | `user.object-type.ts`         |
| Input Type  | `<action>.input.ts`         | `register-user.input.ts`      |
| Args Type   | `<action>.args.ts`          | `find-user.args.ts`           |
| Validation  | `<action>.validation.ts`    | `register-user.validation.ts` |
| Mapper      | `<name>.mapper.ts`          | `user.mapper.ts`              |
| Loader      | `<relation>.loader.ts`      | `orders-by-user.loader.ts`    |
| Error       | `<module>-errors.ts`        | `user-errors.ts`              |
| Factory     | `<name>.factory.ts`         | `user.factory.ts`             |
| Types       | `index.ts` (in `types/`)    | `types/index.ts`              |

---

## Key Principles

### 1. Immutability

Entities are immutable. All properties are `readonly`.

### 2. Separation of Concerns

Repository knows Prisma. Use-case knows business logic. Resolver knows GraphQL. Entity knows domain rules. Mapper knows the translation between the last two.

### 3. Dependency Injection via Internal Import

Prisma and services are imported internally, never as parameters.

### 4. Error Handling

All errors are domain errors with i18n messages, translated once by Apollo's `formatError`. Never throw Prisma errors or reformat inside a resolver.

### 5. Type Safety

`class-validator` on Input/Args types for GraphQL boundary validation, Zod for environment configuration, TypeScript everywhere.

### 6. Testing as Documentation

Test names and structure document behavior. E2E tests assert on `extensions.code`, the actual wire contract a client relies on.

---

## Common Mistakes to Avoid

| ❌ Mistake                                       | ✅ Solution                                   | Why                                                       |
| ------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------- |
| Prisma as parameter                              | Import from `@/lib/prisma`                    | Repository owns the database connection                   |
| Entity decorated with `@ObjectType()`            | Separate class + mapper                       | Domain refactors shouldn't silently break the schema      |
| `@FieldResolver` calling the repository directly | Batch through a `DataLoader`                  | N+1 queries are GraphQL's default failure mode            |
| DataLoader as module-level singleton             | Build it fresh in `createContext` per request | Prevents cache leakage across requests/users              |
| Generic domain errors                            | Specific error per case, with `code`          | `formatError` needs a stable `extensions.code`            |
| Hardcoded error messages                         | Use i18n service                              | Support multiple languages                                |
| try/catch in tests                               | Use `.rejects.toThrow()`                      | Cleaner, more readable                                    |
| Unit tests for repos                             | Integration tests only                        | Need real database                                        |
| Removing a field outright                        | `@deprecated` first, remove later             | Breaking schema changes need a runway                     |
| No complexity on list fields                     | Declare `complexity` explicitly               | Unbounded nested queries are a GraphQL-specific cost risk |

---

## References

- **`constitution.md`** — Architectural principles (DDD, layered architecture, GraphQL exceptions)
- **`CLAUDE.md`** — Development commands, testing setup, module creation workflow
- **This guide** — Practical patterns and examples

---

## Questions?

If something is unclear, check:

1. This guide's relevant section
2. `constitution.md` for principles
3. `CLAUDE.md` for commands
4. Existing modules in `src/modules/` for real examples
