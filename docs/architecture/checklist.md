# Checklist

Use this checklist before creating a PR for a new module or feature.

## Pre-Implementation

- [ ] **Spec written** (`docs/features/PM-NNN/spec.md`)
- [ ] **Plan written** (`docs/features/PM-NNN/plan.md`), DoR blueprints present (see [11. DoR](11-dor.md))
- [ ] **Tasks created** (`docs/features/PM-NNN/tasks.md`)

## Module Structure

- [ ] **Directory structure** matches [01. Module Structure](01-module-structure.md)
- [ ] **All required files created:**
  - [ ] `entity/<name>.entity.ts`
  - [ ] `types/index.ts`
  - [ ] `errors/<module>-errors.ts`
  - [ ] `graphql/input-types/<action>.input.ts` (or `graphql/args/<action>.args.ts`)
  - [ ] `validation/<action>.validation.ts`
  - [ ] `repository/<name>.repository.ts`
  - [ ] `use-cases/<action>.use-case.ts`
  - [ ] `graphql/object-types/<name>.object-type.ts`
  - [ ] `mappers/<name>.mapper.ts`
  - [ ] `resolvers/<name>.resolver.ts`
  - [ ] `loaders/<relation>.loader.ts` (only if the module exposes relations)
  - [ ] `index.ts` (barrel export)

## Entity

- [ ] Constructor is private
- [ ] All properties are readonly
- [ ] Static `create()` and `fromRepository()` methods
- [ ] No side effects, **no `type-graphql`/`class-validator` decorators**
- [ ] Types exported (`UserProps`, `CreateUserProps`)

## Repository

- [ ] Prisma imported internally (not as parameter)
- [ ] Uses `findUnique` + validation (not `findUniqueOrThrow`)
- [ ] Returns entity objects (via `.fromRepository()`)
- [ ] Throws custom domain errors
- [ ] `findManyByIds` (or similar) added if a DataLoader needs it
- [ ] No unit tests (integration tests only, real database via `useDatabase()`)

## Errors

- [ ] Custom errors extend `DomainError`
- [ ] Error messages are i18n keys (never hardcoded)
- [ ] `code: DomainErrorCode` set — not an HTTP status
- [ ] `Object.setPrototypeOf` set for instanceof checks

## GraphQL Types & Validation

- [ ] `@InputType()`/`@ArgsType()` carries both `@Field()` and `class-validator` decorators
- [ ] Every decorator's `message` is an i18n key
- [ ] Validation wrapper calls `validateInput()`
- [ ] `@ObjectType()` classes carry no validation decorators
- [ ] Mapper (`toXType()`) exists for every entity this feature returns, and is pure

## Use-Case

- [ ] Business logic only (no GraphQL concerns)
- [ ] Orchestrates domain objects (entities, repositories, gateways)
- [ ] Returns entities/domain types, **never** a GraphQL type
- [ ] Throws custom domain errors
- [ ] Events emitted without await (fire-and-forget)
- [ ] Max 200 lines (split if larger)

## Resolver

- [ ] Validates input, delegates to use-case, maps output — no business logic
- [ ] Errors bubble up unmodified (no try/catch reformatting)
- [ ] Registered in `src/schema/build-schema.ts`
- [ ] Relational `@FieldResolver`s use a `DataLoader`, never a direct repository call
- [ ] Max 100 lines

## Testing

### Unit Tests

- [ ] **Entity tests** (`__tests__/unit/entity/`) — creation, defaults, business methods
- [ ] **Validation tests** (`__tests__/unit/validation/`) — valid data passes, invalid throws `ValidationError` with metadata
- [ ] **Use-case tests** (`__tests__/unit/use-cases/`) — mocked repositories/services, happy + error paths
- [ ] **Mapper tests** (`__tests__/unit/mappers/`) — entity fields land correctly on the GraphQL type

### Integration Tests

- [ ] **Repository tests** (`__tests__/integration/repository/`) — real database via `useDatabase()`, no mocking

### E2E Tests

- [ ] **Operation tests** (`__tests__/integration/e2e/`) — success case, `BAD_USER_INPUT`, every domain error the operation throws, asserted via `response.body.singleResult.errors[].extensions.code`

## Test Implementation

- [ ] No try/catch in async tests → use `.rejects.toThrow()`
- [ ] Factories in `__tests__/factories/`
- [ ] One `describe` block per test file
- [ ] Test names document behavior (specify which error/code)
- [ ] All tests passing (`pnpm test`)

## i18n

- [ ] All error messages in i18n service
- [ ] All validation messages in i18n service
- [ ] Both locales included (`en`, `pt-br`)
- [ ] Keys organized by domain (`errors.*`, `validations.*`)

## Configuration

- [ ] New env vars added to `config/environments.ts` with Zod validation
- [ ] Accessed via `Environments` getters (not direct `process.env`)
- [ ] Bracket notation used for `process.env['KEY']`

## Code Quality

- [ ] No `console.log` (use logger or i18n for user-facing messages)
- [ ] Type-safe (no `any`)
- [ ] No circular dependencies
- [ ] No unnecessary comments (code is self-documenting)
- [ ] File size limits respected (see [01. Module Structure](01-module-structure.md))

## Barrel Export

- [ ] Public API in `index.ts`
- [ ] Only exported: entity, types, enums, errors, repository, resolver
- [ ] **Not exported:** use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders
- [ ] Consumers import from `@/modules/<name>` only

## Database & Schema

- [ ] Prisma schema updated (if new models), migration created (`pnpm prisma migrate dev`)
- [ ] `schema.graphql` regenerated and committed if this feature changed the GraphQL schema
- [ ] Breaking schema changes go through `@deprecated` first (see [14. Feature Planning Checklist](14-feature-planning-checklist.md#13-backward-compatibility))

## Documentation

- [ ] Spec complete with acceptance criteria
- [ ] Plan documented with DoR blueprints
- [ ] Tasks checked off as completed

## Before Merging

- [ ] All tests passing (`pnpm test`)
- [ ] No TypeScript errors (`pnpm build`)
- [ ] Code reviewed (PR has approvals)
- [ ] Checklist complete (this document)
- [ ] Dependent branches rebased (if part of stacked PRs)

## Post-Merge

- [ ] Feature status updated
- [ ] Dependent branches tested (if stacked PRs)

---

## Quick Module Audit

```bash
# Check file structure
find src/modules/<module> -type f | grep -E '\.ts$'

# Check tests exist
find src/modules/<module>/__tests__ -type f | grep -E '\.test\.ts$' | wc -l

# Check no console.log
grep -r "console\." src/modules/<module> --include="*.ts"

# Check no any
grep -r ": any" src/modules/<module> --include="*.ts"

# Check file sizes
wc -l src/modules/<module>/**/*.ts | sort -rn
```

---

This checklist ensures new modules follow the architecture patterns consistently. Review before every PR.
