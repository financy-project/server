# Skill: Scaffold Module

**ID**: scaffold

**Version**: 1.0.0

**Type**: generator

**Applicable Packages**: backend

## Description

Automatically creates new module structure with all directories and barrel files following the project's GraphQL/Apollo/TypeGraphQL/Prisma architecture patterns.

Creates complete module skeleton in ~100ms with zero configuration overhead. All barrel files (index.ts) pre-generated and ready for implementation.

## Usage

```bash
# Create new module via skill
/scaffold <module-name>

# Or via npm command (once package.json has the "scaffold" script)
pnpm scaffold <module-name>

# Or direct script (works right away, no package.json needed)
node scripts/scaffold-module.js <module-name>
```

## Examples

```
/scaffold transaction
/scaffold category
/scaffold budget
```

## What Gets Created

Complete module structure with all layers and test organization:

```
src/modules/<name>/
  ├── entity/                     # Barrel: export entity + types only, no decorators
  ├── types/                      # Barrel: export plain TS types only
  ├── enums/                      # Barrel: export enums (SCREAMING_SNAKE_CASE)
  ├── errors/                     # Barrel: export domain errors
  ├── graphql/
  │   ├── object-types/           # @ObjectType() — schema output shape
  │   ├── input-types/            # @InputType() + class-validator decorators
  │   └── args/                   # @ArgsType() — grouped scalar arguments
  ├── validation/                 # Barrel: export validators (validateInput wrappers)
  ├── mappers/                    # Barrel: export entity → object-type functions
  ├── repository/                 # Barrel: re-export repository
  ├── use-cases/                  # Barrel: re-export use-cases
  ├── resolvers/                  # Barrel: re-export resolvers
  ├── loaders/                    # (Optional) Barrel: DataLoader factories
  ├── ports/                      # (Optional) Barrel: port definitions
  ├── adapters/                   # (Optional) Barrel: adapters
  ├── gateways/                   # (Optional) Barrel: gateways
  ├── __tests__/
  │   ├── unit/
  │   │   ├── entity/             # Entity tests (one file = one action)
  │   │   ├── validation/         # Validation tests
  │   │   ├── use-cases/          # Use-case tests (mocked)
  │   │   └── mappers/            # Mapper tests
  │   ├── integration/
  │   │   ├── repository/         # Repository tests (real database)
  │   │   └── e2e/                # E2E GraphQL operation tests
  │   └── factories/               # Test data generators
  └── index.ts                    # Module public API (barrel)
```

## Implementation

- **Script**: `scripts/scaffold-module.js` (Node.js, pure JS, zero external dependencies)
- **Command**: `pnpm scaffold <name>`
- **Speed**: ~100ms to create full structure

## Architecture Compliance

Structure strictly enforces architecture patterns through file organization:

- **Layers separated**: entity, types, enums, errors, graphql (object-types/input-types/args), validation, mappers, repository, use-cases, resolvers, (optional: loaders, ports, adapters, gateways)
- **Barrel files pre-generated**: internal barrels (`entity/index.ts`, `graphql/object-types/index.ts`, etc.) with isolation rules built-in
- **Enums in dedicated folder**: all domain enums in `enums/` with SCREAMING_SNAKE_CASE keys
- **Test organization by layer**: `unit/entity/`, `unit/validation/`, `unit/use-cases/`, `unit/mappers/`, `integration/repository/`, `integration/e2e/`, `factories/`
- **Test granularity**: one test file per action/method (required: one `describe` block per file)
- **Public API isolation**: module `index.ts` clearly lists what is exported vs what is internal
- **Following [13-backend-development-checklist.md](../../../docs/architecture/13-backend-development-checklist.md)**: all generated structure aligns with the layer-by-layer implementation guide

## Next Steps After Scaffolding

**⚠️ IMPORTANT: Follow this layer-by-layer guide before implementing each layer.**

1. **Read the implementation guide**: [docs/architecture/13-backend-development-checklist.md](../../../docs/architecture/13-backend-development-checklist.md)
2. **Create enums** (if needed): `enums/<name>.enum.ts` — SCREAMING_SNAKE_CASE, `registerEnumType()` only if schema-exposed
3. **Create errors**: `errors/<module>-errors.ts` — extend `DomainError`, set `code: DomainErrorCode`
4. **Create types**: `types/index.ts` — Props, CreateProps
5. **Implement entity**: `entity/<name>.entity.ts` — private constructor, `create()`, `fromRepository()`, no decorators
6. **Write entity tests**: `__tests__/unit/entity/<name>-<action>-describe.test.ts`
7. **Create GraphQL Input/Args type + validation**: `graphql/input-types/<action>.input.ts` (class-validator decorators) + `validation/<action>.validation.ts` (`validateInput()` wrapper)
8. **Write validation tests**: `__tests__/unit/validation/<action>-validation-describe.test.ts`
9. **Implement repository**: `repository/<name>.repository.ts` — add `findManyByIds` if a loader will need it
10. **Write repository integration tests**: `__tests__/integration/repository/<name>-repository-describe.test.ts` — real database
11. **Implement use-case**: `use-cases/<action>.use-case.ts` — returns entities only
12. **Write use-case tests**: `__tests__/unit/use-cases/<action>-describe.test.ts` — mocked
13. **Implement GraphQL Object Type + mapper**: `graphql/object-types/<name>.object-type.ts` + `mappers/<name>.mapper.ts`
14. **Write mapper tests**: `__tests__/unit/mappers/<name>-mapper-describe.test.ts`
15. **Implement resolver**: `resolvers/<name>.resolver.ts` — validate → use-case → map
16. **Register the resolver**: add the class to `src/schema/build-schema.ts`
17. **Add loaders** (if the module exposes relations): `loaders/<relation>.loader.ts`, wire into the context factory
18. **Write E2E tests**: `__tests__/integration/e2e/<action>-describe.test.ts` — real operations via `executeOperation()`
19. **Update all barrel files**: as you add files, update `index.ts` in each folder
20. **Regenerate `schema.graphql`** if this feature changes the schema
21. **Validate**: `/architecture-audit src/modules/<name>`

## Features

- ✅ Creates directory structure automatically
- ✅ Generates all barrel files (index.ts)
- ✅ Zero configuration needed
- ✅ Enforces architecture patterns through structure
- ✅ Works offline (no external calls)
- ✅ Can be run multiple times
- ✅ Idempotent (validates module doesn't exist first)

## Error Handling

### Module Already Exists

```
❌ Module 'transaction' already exists
→ Choose different name or delete existing module first
```

### Invalid Module Name

```
❌ Invalid module name: 'TransactionModule'
→ Use lowercase, hyphens allowed: transaction, budget-category
```

## Related Documentation

- `CLAUDE.md` — Development commands and workflow
- `docs/architecture/01-module-structure.md` — Module organization
- `docs/architecture/02-entities.md` — Entity pattern
- `docs/architecture/06-graphql-types.md` — GraphQL types + mapper pattern
- `constitution.md` — Architectural principles

## Integration with Other Skills

Works with:

- `/architecture-audit` — Validate created modules
- `/write-test` — Add tests to scaffolded module
- `/commit` — Commit the scaffolded structure atomically

## Workflow

```
Step 1: Create module structure
→ /scaffold transaction

Step 2: Implement following patterns
→ Read docs/architecture/

Step 3: Validate architecture
→ /architecture-audit src/modules/transaction

Step 4: Write tests
→ /write-test

Step 5: Commit
→ /commit
```
