# Skill: Architecture Audit

**ID**: architecture-audit

**Version**: 1.0.0

**Type**: validator

**Applicable Packages**: backend

## Description

Validates module code against architecture patterns defined in `docs/architecture/`. Detects violations with line numbers and links to relevant documentation.

Checks 10 layers across entity, repository, errors, validation, GraphQL types, mappers, use-cases, resolvers, loaders, and tests.

## Usage

```bash
# Audit specific module
/architecture-audit <module-path>

# Examples
/architecture-audit src/modules/transaction
/architecture-audit src/modules/category
/architecture-audit src/modules/budget
```

## What It Checks

### Entity Layer

- ✅ Constructor is private
- ✅ Has static `create()` factory
- ✅ Has static `fromRepository()` factory
- ✅ Properties are readonly
- ✅ No setters/mutations
- ✅ **No `type-graphql` or `class-validator` decorators anywhere on the class**

### Repository Layer

- ✅ Prisma imported internally (`@/lib/prisma`)
- ✅ Returns domain entities (not raw database records)
- ✅ Throws domain errors (custom error classes)
- ✅ Uses function pattern (const obj = { fn() {} })
- ✅ No Prisma parameter in functions
- ✅ Has a batch-lookup method (`findManyByIds` or similar) if a loader in this module depends on one

### Errors Layer

- ✅ Custom error classes extend `DomainError`
- ✅ Error messages use i18n keys
- ✅ `code: DomainErrorCode` set (not an HTTP status)
- ✅ One error class per file
- ✅ Specific error names (not generic `EntityNotFoundError`)
- ✅ Exported from `errors/index.ts`

### GraphQL Types Layer

- ✅ `@ObjectType()` classes carry no `class-validator` decorators
- ✅ `@InputType()`/`@ArgsType()` classes carry `class-validator` decorators with i18n-key `message` options
- ✅ No entity is ever decorated with `@ObjectType()`/`@Field()` directly
- ✅ Every `@ObjectType()` has a corresponding mapper in `mappers/`

### Mappers Layer

- ✅ Pure functions only (no async, no I/O, no repository calls)
- ✅ One mapper per entity, named `to<Name>Type`

### Use-Case Layer

- ✅ Returns domain entities only — never a GraphQL type
- ✅ Uses function pattern
- ✅ Delegates to repository/service/gateway
- ✅ Throws domain errors
- ✅ No async/await for sync operations

### Resolver Layer

- ✅ Validates input via `validateInput()` before calling the use-case
- ✅ Delegates to use-case, no business logic inline
- ✅ Maps every returned value through the module's mapper before returning
- ✅ No try/catch reformatting errors (they must bubble to `formatError`)
- ✅ Class-based (`@Resolver()`) — this is one of the four allowed exceptions to the no-class rule

### Loaders Layer (if present)

- ✅ Factory function, not a shared instance
- ✅ Batch function preserves key order
- ✅ Every relational `@FieldResolver` in this module actually uses it (no direct repository calls in a `@FieldResolver`)

### Test Structure

- ✅ Unit tests in `__tests__/unit/` (entity, validation, use-cases, mappers)
- ✅ Integration tests in `__tests__/integration/repository/` — real database, no mocks
- ✅ E2E tests in `__tests__/integration/e2e/` — real operations via `executeOperation()`, asserting on `errors[].extensions.code`
- ✅ Tests use `.rejects.toThrow()` not try/catch
- ✅ Tests specify error type explicitly

### Barrel Files

- ✅ Entity, types, enums, errors, repository, resolvers exported from module `index.ts`
- ✅ **NOT exported**: use-cases, validation, mappers, ports, adapters, gateways, loaders
- ✅ Each internal folder's own `index.ts` barrel is up to date

## Output: Success

```
✅ Architecture audit passed for src/modules/transaction

All patterns followed:
  ✓ Entity: Private constructor, factories, readonly properties, no decorators
  ✓ Repository: Prisma internal, domain errors, entities returned
  ✓ Errors: Custom classes, i18n messages, DomainErrorCode set
  ✓ GraphQL Types: ObjectType undecorated by validation, InputType validated
  ✓ Mappers: Pure functions, one per entity
  ✓ Use-cases: Domain types only, function pattern
  ✓ Resolvers: Validate → use-case → map, no inline business logic
  ✓ Tests: Organized by type, proper assertions
  ✓ Barrel files: All updated correctly

Ready for PR! 🚀
```

## Output: Violations Found

```
⚠️ Architecture audit found 3 violations in src/modules/transaction

Entity Layer:
  ❌ src/modules/transaction/entity/transaction.entity.ts:1
     @ObjectType() decorator found on the entity class
     Fix: Remove the decorator; create a separate TransactionType in graphql/object-types/ and a mapper
     Docs: docs/architecture/02-entities.md, docs/architecture/06-graphql-types.md

Resolver Layer:
  ❌ src/modules/transaction/resolvers/transaction.resolver.ts:12
     @FieldResolver('category') calls TransactionRepository directly
     Fix: Batch through a DataLoader from ctx.loaders instead
     Docs: docs/architecture/12-graphql-operational-concerns.md

Tests:
  ❌ src/modules/transaction/__tests__/integration/e2e/create-transaction-describe.test.ts:20
     Asserting against an internal entity instead of the GraphQL response shape
     Fix: Assert on response.body.singleResult.data / .errors[].extensions.code
     Docs: docs/architecture/08-testing.md

---
Run again after fixes to verify compliance.
```

## Features

- ✅ Scans module directory recursively
- ✅ Checks `.ts` files only
- ✅ Reports violations with line numbers
- ✅ Links to relevant documentation
- ✅ Provides fix suggestions
- ✅ Can run multiple times during development
- ✅ Non-blocking (doesn't prevent commits)

## Exit Codes

- `0`: Success - architecture compliant
- `1`: Violations found (reported but non-fatal)
- `2`: Module directory not found
- `3`: File read error

## Related Documentation

- `docs/architecture/02-entities.md` — Entity pattern details
- `docs/architecture/03-repository.md` — Repository pattern details
- `docs/architecture/04-errors-and-i18n.md` — Error handling
- `docs/architecture/05-validation.md` — Validation patterns
- `docs/architecture/06-graphql-types.md` — GraphQL types + mapper pattern
- `docs/architecture/07-use-cases-and-resolvers.md` — Business logic and resolvers
- `docs/architecture/12-graphql-operational-concerns.md` — DataLoader, complexity
- `docs/architecture/checklist.md` — Full pre-PR checklist

## Integration with Other Skills

Works with:

- `/scaffold` — Create modules that pass audit
- `/write-test` — Add compliant tests
- `/commit` — Commit once the audit passes

## Workflow

```
Step 1: Create module
→ /scaffold transaction

Step 2: Implement features
→ Read docs/architecture/

Step 3: Validate before commit
→ /architecture-audit src/modules/transaction

Step 4: Fix any violations
→ Use suggestions in audit output

Step 5: Verify fixes
→ /architecture-audit src/modules/transaction (again)

Step 6: Commit and push
→ /commit
```

## Common Violations & Fixes

### Entity Decorated for GraphQL

```typescript
// ❌ WRONG
@ObjectType()
export class Transaction {
  @Field() readonly amount: number
}

// ✅ CORRECT — separate class + mapper
export class Transaction {
  readonly amount: number
}

@ObjectType()
export class TransactionType {
  @Field() amount!: number
}
```

### FieldResolver Bypassing the Loader

```typescript
// ❌ WRONG
@FieldResolver(() => CategoryType)
async category(@Root() tx: TransactionType) {
  return toCategoryType(await CategoryRepository.findById(tx.categoryId))
}

// ✅ CORRECT
@FieldResolver(() => CategoryType)
async category(@Root() tx: TransactionType, @Ctx() ctx: GraphQLContext) {
  return toCategoryType(await ctx.loaders.categoryById.load(tx.categoryId))
}
```

### Prisma as Parameter

```typescript
// ❌ WRONG
async function findById(id: string, prisma: PrismaClient) {}

// ✅ CORRECT
async function findById(id: string) {
  return prisma.transaction.findUnique({ where: { id } })
}
```

### try/catch in Tests

```typescript
// ❌ WRONG
it('throws error', async () => {
  try {
    await repository.find('x')
    fail('should throw')
  } catch (error) {
    expect(error).toBeDefined()
  }
})

// ✅ CORRECT
it('throws TransactionNotFoundError', async () => {
  await expect(repository.find('x')).rejects.toThrow(TransactionNotFoundError)
})
```
